import { status as HttpStatus } from "http-status";
import type { User } from "~/generated/prisma/client";
import { hashedPass, comparePassword } from "~/lib/bycrpt";
import prisma from "~/lib/db";
import { HttpError } from "~/middlewares/error-handler";
import { normalizeTeamPermissions } from "~/lib/permissions";
import { emitProviderAvailability } from "~/lib/socket";
import type {
  ChangePasswordBody,
  UpdateAvailabilityBody,
  UpdateMeBody,
} from "~/schemas/auth-schemas";
import type { TokenPayload } from "~/types";
import { UserRole, UserStatus } from "~/generated/prisma/client";

const userInclude = {
  facility: { select: { id: true, name: true } },
} as const;

type UserWithFacility = User & {
  facility: { id: string; name: string } | null;
};

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.slice(1).join(" ") || parts[0] || name.trim(),
  };
}

function publicUser(user: UserWithFacility) {
  const { passwordHash: _passwordHash, facility, ...safeUser } = user;
  return {
    ...safeUser,
    name: `${user.firstName} ${user.lastName}`.trim(),
    permissions: normalizeTeamPermissions(user.permissions),
    facilityName: facility?.name ?? null,
  };
}

async function getUserOrThrow(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });
  if (!user) {
    throw new HttpError("Authentication required", HttpStatus.UNAUTHORIZED);
  }
  return user;
}

export async function getMe(auth: TokenPayload) {
  const user = await getUserOrThrow(auth.id);
  return publicUser(user);
}

export async function updateMe(auth: TokenPayload, input: UpdateMeBody) {
  const user = await getUserOrThrow(auth.id);
  const email = input.email.trim().toLowerCase();
  const { firstName, lastName } = splitName(input.name);

  if (email !== user.email) {
    const [emailUser, emailFacility] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.facility.findUnique({ where: { email } }),
    ]);
    if (emailUser || emailFacility) {
      throw new HttpError(
        "An account with this email already exists",
        HttpStatus.CONFLICT,
      );
    }
  }

  let avatarUrl = user.avatarUrl;
  let avatarPublicId = user.avatarPublicId;

  if (input.avatarUrl?.trim()) {
    const nextUrl = input.avatarUrl.trim();
    if (!/^https?:\/\//i.test(nextUrl)) {
      throw new HttpError(
        "avatarUrl must be a Cloudinary HTTPS URL",
        HttpStatus.BAD_REQUEST,
      );
    }
    avatarUrl = nextUrl;
    avatarPublicId = input.avatarPublicId?.trim() || avatarPublicId;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      email,
      phone: input.phone.trim(),
      avatarUrl,
      avatarPublicId,
      ...(input.specialty !== undefined
        ? { specialty: input.specialty.trim() }
        : {}),
      ...(input.medicalLicense !== undefined
        ? { medicalLicense: input.medicalLicense.trim() }
        : {}),
      ...(input.education !== undefined
        ? { education: input.education.trim() }
        : {}),
      ...(input.yearsExperience !== undefined
        ? { yearsExperience: input.yearsExperience.trim() }
        : {}),
      ...(input.primaryLanguage !== undefined
        ? { primaryLanguage: input.primaryLanguage.trim() }
        : {}),
      ...(input.availability !== undefined
        ? { availability: input.availability.trim() }
        : {}),
    },
    include: userInclude,
  });

  return publicUser(updated);
}

export async function updateAvailability(
  auth: TokenPayload,
  input: UpdateAvailabilityBody,
) {
  const user = await getUserOrThrow(auth.id);

  if (user.role !== UserRole.DOCTOR) {
    throw new HttpError(
      "Only providers can update live availability",
      HttpStatus.FORBIDDEN,
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new HttpError("This account is inactive", HttpStatus.FORBIDDEN);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isAvailable: input.isAvailable },
    include: userInclude,
  });

  emitProviderAvailability({
    id: updated.id,
    name: `${updated.firstName} ${updated.lastName}`.trim(),
    specialty: updated.specialty,
    avatarUrl: updated.avatarUrl,
    availability: updated.availability,
    isAvailable: updated.isAvailable,
  });

  return publicUser(updated);
}

export async function changePassword(
  auth: TokenPayload,
  input: ChangePasswordBody,
) {
  const user = await getUserOrThrow(auth.id);

  if (!user.passwordHash) {
    throw new HttpError(
      "Set your password from the invite link first",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (
    !comparePassword({
      password: input.currentPassword,
      hash: user.passwordHash,
    })
  ) {
    throw new HttpError("Current password is incorrect", HttpStatus.BAD_REQUEST);
  }

  if (input.currentPassword === input.newPassword) {
    throw new HttpError(
      "New password must be different from your current password",
      HttpStatus.BAD_REQUEST,
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashedPass(input.newPassword) },
  });

  return { id: user.id };
}
