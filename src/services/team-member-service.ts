import { randomBytes } from "node:crypto";
import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus, type User } from "~/generated/prisma/client";
import env from "~/env";
import prisma from "~/lib/db";
import {
  buildStaffInviteEmail,
  createStaffInviteToken,
} from "~/lib/facility-invite";
import { sendEmail } from "~/lib/mailer";
import { normalizeTeamPermissions } from "~/lib/permissions";
import { HttpError } from "~/middlewares/error-handler";
import type {
  CreateTeamMemberBody,
  ListTeamMembersQuery,
  UpdateTeamMemberBody,
} from "~/schemas/team-member-schemas";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.slice(1).join(" ") || parts[0] || name.trim(),
  };
}

function publicTeamMember(user: User) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    name: `${user.firstName} ${user.lastName}`.trim(),
    permissions: normalizeTeamPermissions(user.permissions),
  };
}

async function uniqueEmployeeId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const employeeId = `TM-${randomBytes(3).toString("hex").toUpperCase()}`;
    const existing = await prisma.user.findFirst({ where: { employeeId } });
    if (!existing) {
      return employeeId;
    }
  }
  throw new HttpError(
    "Could not assign an employee ID. Try again.",
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

async function sendTeamMemberInvite(user: User) {
  const token = createStaffInviteToken({
    userId: user.id,
    email: user.email,
  });
  const appUrl = (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const inviteUrl = `${appUrl}/auth/set-password?token=${encodeURIComponent(token)}`;

  return sendEmail(
    buildStaffInviteEmail({
      name: `${user.firstName} ${user.lastName}`.trim(),
      roleLabel: "team member",
      facilityName: "PrestigeMD",
      email: user.email,
      inviteUrl,
    }),
  );
}

async function assertEmailAvailable(email: string, excludeUserId?: string) {
  const [emailUser, emailFacility] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.facility.findUnique({ where: { email } }),
  ]);

  if (emailFacility || (emailUser && emailUser.id !== excludeUserId)) {
    throw new HttpError(
      "An account with this email already exists",
      HttpStatus.CONFLICT,
    );
  }
}

export async function createTeamMember(input: CreateTeamMemberBody) {
  const email = input.email.toLowerCase();
  const { firstName, lastName } = splitName(input.name);
  const permissions = normalizeTeamPermissions(input.permissions);

  await assertEmailAvailable(email);

  const member = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone: input.phone.trim(),
      employeeId: await uniqueEmployeeId(),
      role: UserRole.TEAM_MEMBER,
      status: UserStatus.ACTIVE,
      permissions,
      invitedAt: new Date(),
    },
  });

  const emailSent = await sendTeamMemberInvite(member);

  return {
    member: publicTeamMember(member),
    emailSent,
  };
}

export async function listTeamMembers(query: ListTeamMembersQuery) {
  const search = query.search?.trim();

  const members = await prisma.user.findMany({
    where: {
      role: UserRole.TEAM_MEMBER,
      status: query.status,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { employeeId: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return members.map(publicTeamMember);
}

async function getTeamMemberOrThrow(id: string) {
  const member = await prisma.user.findFirst({
    where: { id, role: UserRole.TEAM_MEMBER },
  });

  if (!member) {
    throw new HttpError("Team member not found", HttpStatus.NOT_FOUND);
  }

  return member;
}

export async function getTeamMember(id: string) {
  return publicTeamMember(await getTeamMemberOrThrow(id));
}

export async function updateTeamMember(id: string, input: UpdateTeamMemberBody) {
  await getTeamMemberOrThrow(id);

  const email = input.email.toLowerCase();
  const { firstName, lastName } = splitName(input.name);
  const permissions = normalizeTeamPermissions(input.permissions);

  await assertEmailAvailable(email, id);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone: input.phone.trim(),
      permissions,
    },
  });

  return publicTeamMember(updated);
}

export async function blockTeamMember(id: string) {
  const member = await getTeamMemberOrThrow(id);

  if (member.status === UserStatus.INACTIVE) {
    return publicTeamMember(member);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE },
  });

  return publicTeamMember(updated);
}

export async function unblockTeamMember(id: string) {
  const member = await getTeamMemberOrThrow(id);

  if (member.status === UserStatus.ACTIVE) {
    return publicTeamMember(member);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.ACTIVE },
  });

  return publicTeamMember(updated);
}
