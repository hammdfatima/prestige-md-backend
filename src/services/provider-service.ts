import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus, type User } from "~/generated/prisma/client";
import env from "~/env";
import prisma from "~/lib/db";
import {
  buildStaffInviteEmail,
  createStaffInviteToken,
} from "~/lib/facility-invite";
import { sendEmail } from "~/lib/mailer";
import { HttpError } from "~/middlewares/error-handler";
import type {
  CreateProviderBody,
  ListProvidersQuery,
} from "~/schemas/provider-schemas";
import { emitProviderAvailability } from "~/lib/socket";
import type { TokenPayload } from "~/types";

type ProviderRecord = User & {
  facility: { id: string; name: string } | null;
  facilityLinks: Array<{
    facility: { id: string; name: string };
  }>;
  _count?: {
    visitsAsProvider: number;
  };
};

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.slice(1).join(" ") || parts[0] || name.trim(),
  };
}

function publicProvider(provider: ProviderRecord) {
  const {
    passwordHash: _passwordHash,
    facilityLinks,
    _count,
    ...safeProvider
  } = provider;
  const facilities = facilityLinks.map((link) => link.facility);

  return {
    ...safeProvider,
    name: `${provider.firstName} ${provider.lastName}`.trim(),
    facilities,
    facilityIds: facilities.map((facility) => facility.id),
    facilityName: facilities.map((facility) => facility.name).join(", ") || null,
    visitCount: _count?.visitsAsProvider ?? 0,
  };
}

const providerInclude = {
  facility: { select: { id: true, name: true } },
  facilityLinks: {
    include: { facility: { select: { id: true, name: true } } },
  },
  _count: { select: { visitsAsProvider: true } },
} as const;

async function sendProviderInvite(provider: ProviderRecord) {
  const token = createStaffInviteToken({
    userId: provider.id,
    email: provider.email,
  });
  const appUrl = (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const inviteUrl = `${appUrl}/auth/set-password?token=${encodeURIComponent(token)}`;
  const facilityName =
    provider.facilityLinks[0]?.facility.name ??
    provider.facility?.name ??
    "PrestigeMD";

  return sendEmail(
    buildStaffInviteEmail({
      name: `${provider.firstName} ${provider.lastName}`.trim(),
      roleLabel: "provider",
      facilityName,
      email: provider.email,
      inviteUrl,
    }),
  );
}

export async function createProvider(input: CreateProviderBody) {
  const email = input.email.toLowerCase();
  const { firstName, lastName } = splitName(input.name);
  const facilityIds = [...new Set(input.facilityIds)];

  const facilities = await prisma.facility.findMany({
    where: { id: { in: facilityIds } },
  });

  if (facilities.length !== facilityIds.length) {
    throw new HttpError("One or more facilities were not found", HttpStatus.NOT_FOUND);
  }

  const inactive = facilities.find(
    (facility) => facility.status !== UserStatus.ACTIVE,
  );
  if (inactive) {
    throw new HttpError(
      "Cannot assign a provider to an inactive facility",
      HttpStatus.BAD_REQUEST,
    );
  }

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

  const avatarUrl = input.avatarUrl?.trim() || null;
  const avatarPublicId = input.avatarPublicId?.trim() || null;

  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    throw new HttpError(
      "avatarUrl must be a Cloudinary HTTPS URL",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (!avatarUrl) {
    throw new HttpError(
      "Upload a profile photo for the provider",
      HttpStatus.BAD_REQUEST,
    );
  }

  const primaryFacilityId = facilityIds[0];

  const provider = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone: input.phone.trim(),
      avatarUrl,
      avatarPublicId,
      role: UserRole.DOCTOR,
      status: UserStatus.ACTIVE,
      specialty: input.specialty.trim(),
      medicalLicense: input.medicalLicense.trim(),
      education: input.education.trim(),
      yearsExperience: input.yearsExperience.trim(),
      primaryLanguage: input.primaryLanguage.trim(),
      availability: input.availability.trim(),
      invitedAt: new Date(),
      facility: { connect: { id: primaryFacilityId } },
      facilityLinks: {
        create: facilityIds.map((facilityId) => ({ facilityId })),
      },
    },
    include: providerInclude,
  });

  const emailSent = await sendProviderInvite(provider);

  return {
    provider: publicProvider(provider),
    emailSent,
  };
}

export async function listProviders(query: ListProvidersQuery) {
  const search = query.search?.trim();

  const providers = await prisma.user.findMany({
    where: {
      role: UserRole.DOCTOR,
      status: query.status,
      AND: [
        ...(query.facilityId
          ? [
              {
                OR: [
                  { facilityId: query.facilityId },
                  { facilityLinks: { some: { facilityId: query.facilityId } } },
                ],
              },
            ]
          : []),
        ...(search
          ? [
              {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" as const } },
                  { lastName: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                  { specialty: { contains: search, mode: "insensitive" as const } },
                  { phone: { contains: search, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    },
    include: providerInclude,
    orderBy: { createdAt: "desc" },
  });

  return providers.map(publicProvider);
}

export async function listProvidersForViewer(
  auth: TokenPayload,
  query: ListProvidersQuery,
) {
  if (auth.role === UserRole.ADMIN) {
    return listProviders(query);
  }

  if (auth.role === UserRole.TEAM_MEMBER) {
    if (!(auth.permissions ?? []).includes("manage_doctors")) {
      throw new HttpError(
        "You do not have access to this resource",
        HttpStatus.FORBIDDEN,
      );
    }
    return listProviders(query);
  }

  if (auth.role === UserRole.FACILITY_MANAGER) {
    if (!auth.facilityId) {
      return [];
    }
    return listProviders({ ...query, facilityId: auth.facilityId });
  }

  throw new HttpError(
    "You do not have access to this resource",
    HttpStatus.FORBIDDEN,
  );
}

async function getProviderOrThrow(id: string) {
  const provider = await prisma.user.findFirst({
    where: { id, role: UserRole.DOCTOR },
    include: providerInclude,
  });

  if (!provider) {
    throw new HttpError("Provider not found", HttpStatus.NOT_FOUND);
  }

  return provider;
}

export async function blockProvider(id: string) {
  const provider = await getProviderOrThrow(id);

  if (provider.status === UserStatus.INACTIVE) {
    return publicProvider(provider);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE, isAvailable: false },
    include: providerInclude,
  });

  emitProviderAvailability({
    id: updated.id,
    name: `${updated.firstName} ${updated.lastName}`.trim(),
    specialty: updated.specialty,
    avatarUrl: updated.avatarUrl,
    availability: updated.availability,
    isAvailable: false,
  });

  return publicProvider(updated);
}

export async function unblockProvider(id: string) {
  const provider = await getProviderOrThrow(id);

  if (provider.status === UserStatus.ACTIVE) {
    return publicProvider(provider);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.ACTIVE },
    include: providerInclude,
  });

  return publicProvider(updated);
}

export async function resendProviderInvite(id: string) {
  const provider = await getProviderOrThrow(id);

  if (provider.status !== UserStatus.ACTIVE) {
    throw new HttpError(
      "Activate the provider before resending the invite",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (provider.passwordSetAt) {
    throw new HttpError(
      "This provider already set a password",
      HttpStatus.BAD_REQUEST,
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { invitedAt: new Date() },
    include: providerInclude,
  });

  const emailSent = await sendProviderInvite(updated);

  return {
    provider: publicProvider(updated),
    emailSent,
  };
}

export async function listAvailableProviders() {
  const providers = await prisma.user.findMany({
    where: {
      role: UserRole.DOCTOR,
      status: UserStatus.ACTIVE,
      isAvailable: true,
    },
    include: providerInclude,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return providers.map((provider) => ({
    id: provider.id,
    name: `${provider.firstName} ${provider.lastName}`.trim(),
    specialty: provider.specialty,
    avatarUrl: provider.avatarUrl,
    availability: provider.availability,
    isAvailable: provider.isAvailable,
  }));
}
