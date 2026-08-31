import { status as HttpStatus } from "http-status";
import { UserStatus, type Facility } from "~/generated/prisma/client";
import { getAppBaseUrl } from "~/lib/app-url";
import {
  buildFacilityInviteEmail,
  createFacilityInviteToken,
} from "~/lib/facility-invite";
import { sendEmail } from "~/lib/mailer";
import prisma from "~/lib/db";
import { facilityEmailWhere } from "~/lib/encryption-queries";
import { recordMatchesSearch } from "~/lib/encrypted-search";
import { HttpError } from "~/middlewares/error-handler";
import { invalidateFacilityCredentials } from "~/services/session-revocation-service";
import type {
  CreateFacilityBody,
  ListFacilitiesQuery,
} from "~/schemas/facility-schemas";

function publicFacility(facility: Facility) {
  const { passwordHash: _passwordHash, ...safeFacility } = facility;
  return safeFacility;
}

async function sendFacilityInvite(facility: Facility) {
  const token = createFacilityInviteToken({
    facilityId: facility.id,
    email: facility.email,
  });
  const appUrl = getAppBaseUrl();
  const inviteUrl = `${appUrl}/auth/set-password?token=${encodeURIComponent(token)}`;

  return sendEmail(
    buildFacilityInviteEmail({
      managerName: facility.managerName,
      facilityName: facility.name,
      email: facility.email,
      inviteUrl,
    }),
  );
}

export async function createFacility(input: CreateFacilityBody) {
  const email = input.email.toLowerCase();

  const existing = await prisma.facility.findUnique({
    where: facilityEmailWhere(email),
  });

  if (existing) {
    throw new HttpError(
      "A facility with this email already exists",
      HttpStatus.CONFLICT,
    );
  }

  const facility = await prisma.facility.create({
    data: {
      name: input.name.trim(),
      managerName: input.managerName.trim(),
      email,
      location: input.location.trim(),
      phone: input.phone.trim(),
      status: UserStatus.ACTIVE,
      invitedAt: new Date(),
    },
  });

  const emailSent = await sendFacilityInvite(facility);

  return {
    facility: publicFacility(facility),
    emailSent,
  };
}

export async function listFacilities(query: ListFacilitiesQuery) {
  const search = query.search?.trim();

  const facilities = await prisma.facility.findMany({
    where: {
      status: query.status,
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = search
    ? facilities.filter((facility) =>
        recordMatchesSearch(facility, search, [
          "name",
          "managerName",
          "email",
          "location",
        ]),
      )
    : facilities;

  return filtered.map(publicFacility);
}

async function getFacilityOrThrow(id: string) {
  const facility = await prisma.facility.findUnique({ where: { id } });

  if (!facility) {
    throw new HttpError("Facility not found", HttpStatus.NOT_FOUND);
  }

  return facility;
}

export async function blockFacility(id: string) {
  const facility = await getFacilityOrThrow(id);

  if (facility.status === UserStatus.INACTIVE) {
    return publicFacility(facility);
  }

  const updated = await prisma.facility.update({
    where: { id },
    data: { status: UserStatus.INACTIVE },
  });

  await invalidateFacilityCredentials(updated.id);

  return publicFacility(updated);
}

export async function unblockFacility(id: string) {
  const facility = await getFacilityOrThrow(id);

  if (facility.status === UserStatus.ACTIVE) {
    return publicFacility(facility);
  }

  const updated = await prisma.facility.update({
    where: { id },
    data: { status: UserStatus.ACTIVE },
  });

  return publicFacility(updated);
}

export async function resendFacilityInvite(id: string) {
  const facility = await getFacilityOrThrow(id);

  if (facility.status !== UserStatus.ACTIVE) {
    throw new HttpError(
      "Activate the facility before resending the invite",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (facility.passwordSetAt) {
    throw new HttpError(
      "This facility manager already set a password",
      HttpStatus.BAD_REQUEST,
    );
  }

  const updated = await prisma.facility.update({
    where: { id },
    data: { invitedAt: new Date() },
  });

  const emailSent = await sendFacilityInvite(updated);

  return {
    facility: publicFacility(updated),
    emailSent,
  };
}
