import { status as HttpStatus } from "http-status";
import type { Express } from "express";
import { UserRole, UserStatus, type User } from "~/generated/prisma/client";
import { getAppBaseUrl } from "~/lib/app-url";
import {
  toUploadedFile,
  uploadBuffer,
} from "~/lib/cloudinary";
import {
  buildUserObjectPrefix,
  assertOptionalCallerOwnsObjectKey,
} from "~/lib/object-key-ownership";
import prisma from "~/lib/db";
import {
  employeeIdWhere,
  facilityEmailWhere,
  userEmailWhere,
} from "~/lib/encryption-queries";
import {
  buildStaffInviteEmail,
  createStaffInviteToken,
} from "~/lib/facility-invite";
import { sendEmail } from "~/lib/mailer";
import { HttpError } from "~/middlewares/error-handler";
import { hasTeamPermission } from "~/lib/permissions";
import { recordMatchesSearch } from "~/lib/encrypted-search";
import { invalidateUserCredentials } from "~/services/session-revocation-service";
import type { TokenPayload } from "~/types";
import type {
  CreateNurseBody,
  ListNursesQuery,
} from "~/schemas/nurse-schemas";

type NurseRecord = User & {
  facility: { id: string; name: string } | null;
};

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.slice(1).join(" ") || parts[0] || name.trim(),
  };
}

function publicNurse(nurse: NurseRecord) {
  const { passwordHash: _passwordHash, ...safeNurse } = nurse;
  return {
    ...safeNurse,
    name: `${nurse.firstName} ${nurse.lastName}`.trim(),
    facilityName: nurse.facility?.name ?? null,
  };
}

async function withPatientsManaged(nurses: NurseRecord[]) {
  if (nurses.length === 0) {
    return [];
  }

  const visits = await prisma.visit.findMany({
    where: { bookedByUserId: { in: nurses.map((nurse) => nurse.id) } },
    select: { bookedByUserId: true, patientId: true },
  });

  const patientsByNurse = new Map<string, Set<string>>();
  for (const visit of visits) {
    const patients = patientsByNurse.get(visit.bookedByUserId) ?? new Set();
    patients.add(visit.patientId);
    patientsByNurse.set(visit.bookedByUserId, patients);
  }

  return nurses.map((nurse) => ({
    ...publicNurse(nurse),
    patientsManaged: patientsByNurse.get(nurse.id)?.size ?? 0,
  }));
}

const nurseInclude = {
  facility: { select: { id: true, name: true } },
} as const;

async function sendNurseInvite(nurse: NurseRecord) {
  const token = createStaffInviteToken({
    userId: nurse.id,
    email: nurse.email,
  });
  const appUrl = getAppBaseUrl();
  const inviteUrl = `${appUrl}/auth/set-password?token=${encodeURIComponent(token)}`;

  return sendEmail(
    buildStaffInviteEmail({
      name: `${nurse.firstName} ${nurse.lastName}`.trim(),
      roleLabel: "nurse",
      facilityName: nurse.facility?.name ?? "PrestigeMD",
      email: nurse.email,
      inviteUrl,
    }),
  );
}

async function uploadNurseAvatar(
  auth: TokenPayload,
  file: Express.Multer.File,
) {
  const result = await uploadBuffer(file.buffer, {
    folder: buildUserObjectPrefix(auth),
    mimeType: file.mimetype,
    filename: file.originalname,
  });
  return toUploadedFile(result, file.originalname);
}

export async function createNurse(
  auth: TokenPayload,
  input: CreateNurseBody,
  file?: Express.Multer.File,
) {
  const email = input.email.toLowerCase();
  const employeeId = input.employeeId.trim();
  const { firstName, lastName } = splitName(input.name);

  const facility = await prisma.facility.findUnique({
    where: { id: input.facilityId },
  });

  if (!facility) {
    throw new HttpError("Facility not found", HttpStatus.NOT_FOUND);
  }

  if (facility.status !== UserStatus.ACTIVE) {
    throw new HttpError(
      "Cannot assign a nurse to an inactive facility",
      HttpStatus.BAD_REQUEST,
    );
  }

  const [emailUser, emailFacility, existingEmployee] = await Promise.all([
    prisma.user.findUnique({ where: userEmailWhere(email) }),
    prisma.facility.findUnique({ where: facilityEmailWhere(email) }),
    prisma.user.findFirst({ where: employeeIdWhere(employeeId) }),
  ]);

  if (emailUser || emailFacility) {
    throw new HttpError(
      "An account with this email already exists",
      HttpStatus.CONFLICT,
    );
  }

  if (existingEmployee) {
    throw new HttpError(
      "A staff member with this employee ID already exists",
      HttpStatus.CONFLICT,
    );
  }

  let avatarUrl = input.avatarUrl?.trim() || null;
  let avatarPublicId = input.avatarPublicId?.trim() || null;

  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    throw new HttpError(
      "avatarUrl must be a Cloudinary HTTPS URL",
      HttpStatus.BAD_REQUEST,
    );
  }

  assertOptionalCallerOwnsObjectKey(auth, avatarPublicId);

  if (file?.buffer?.byteLength) {
    const uploaded = await uploadNurseAvatar(auth, file);
    avatarUrl = uploaded.secureUrl;
    avatarPublicId = uploaded.publicId;
  }

  if (!avatarUrl) {
    throw new HttpError("Upload a profile photo for the nurse", HttpStatus.BAD_REQUEST);
  }

  const nurse = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone: input.phone.trim(),
      employeeId,
      avatarUrl,
      avatarPublicId,
      role: UserRole.NURSE,
      status: UserStatus.ACTIVE,
      facilityId: facility.id,
      invitedAt: new Date(),
    },
    include: nurseInclude,
  });

  const emailSent = await sendNurseInvite(nurse);

  return {
    nurse: publicNurse(nurse),
    emailSent,
  };
}

export async function listNurses(query: ListNursesQuery) {
  const search = query.search?.trim();

  const nurses = await prisma.user.findMany({
    where: {
      role: UserRole.NURSE,
      status: query.status,
      facilityId: query.facilityId,
    },
    include: nurseInclude,
    orderBy: { createdAt: "desc" },
  });

  const filtered = search
    ? nurses.filter((nurse) =>
        recordMatchesSearch(nurse, search, [
          "firstName",
          "lastName",
          "email",
          "employeeId",
          "phone",
        ]),
      )
    : nurses;

  return withPatientsManaged(filtered);
}

export async function listNursesForViewer(
  auth: TokenPayload,
  query: ListNursesQuery,
) {
  if (auth.role === UserRole.ADMIN) {
    return listNurses(query);
  }

  if (auth.role === UserRole.TEAM_MEMBER) {
    if (!hasTeamPermission(auth, "manage_nurses")) {
      throw new HttpError(
        "You do not have access to this resource",
        HttpStatus.FORBIDDEN,
      );
    }
    return listNurses(query);
  }

  if (auth.role === UserRole.FACILITY_MANAGER) {
    if (!auth.facilityId) {
      return [];
    }
    return listNurses({ ...query, facilityId: auth.facilityId });
  }

  throw new HttpError(
    "You do not have access to this resource",
    HttpStatus.FORBIDDEN,
  );
}

async function getNurseOrThrow(id: string) {
  const nurse = await prisma.user.findFirst({
    where: { id, role: UserRole.NURSE },
    include: nurseInclude,
  });

  if (!nurse) {
    throw new HttpError("Nurse not found", HttpStatus.NOT_FOUND);
  }

  return nurse;
}

export async function blockNurse(id: string) {
  const nurse = await getNurseOrThrow(id);

  if (nurse.status === UserStatus.INACTIVE) {
    return publicNurse(nurse);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE },
    include: nurseInclude,
  });

  await invalidateUserCredentials(updated.id, updated.role);

  return publicNurse(updated);
}

export async function unblockNurse(id: string) {
  const nurse = await getNurseOrThrow(id);

  if (nurse.status === UserStatus.ACTIVE) {
    return publicNurse(nurse);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.ACTIVE },
    include: nurseInclude,
  });

  return publicNurse(updated);
}

export async function resendNurseInvite(id: string) {
  const nurse = await getNurseOrThrow(id);

  if (nurse.status !== UserStatus.ACTIVE) {
    throw new HttpError(
      "Activate the nurse before resending the invite",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (nurse.passwordSetAt) {
    throw new HttpError(
      "This nurse already set a password",
      HttpStatus.BAD_REQUEST,
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { invitedAt: new Date() },
    include: nurseInclude,
  });

  const emailSent = await sendNurseInvite(updated);

  return {
    nurse: publicNurse(updated),
    emailSent,
  };
}
