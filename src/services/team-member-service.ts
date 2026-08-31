import { randomBytes } from "node:crypto";
import { status as HttpStatus } from "http-status";
import { UserRole, UserStatus, type User } from "~/generated/prisma/client";
import { getAppBaseUrl } from "~/lib/app-url";
import prisma from "~/lib/db";
import {
  facilityEmailWhere,
  employeeIdWhere,
  userEmailWhere,
} from "~/lib/encryption-queries";
import { recordMatchesSearch } from "~/lib/encrypted-search";
import {
  buildStaffInviteEmail,
  createStaffInviteToken,
} from "~/lib/facility-invite";
import { sendEmail } from "~/lib/mailer";
import { normalizeTeamPermissions } from "~/lib/permissions";
import {
  formatAuditTargetResource,
  recordSecurityAuditEvent,
  SECURITY_AUDIT_EVENTS,
  type AuditRequestContext,
} from "~/lib/security-audit";
import { HttpError } from "~/middlewares/error-handler";
import { invalidateUserCredentials } from "~/services/session-revocation-service";
import type {
  CreateTeamMemberBody,
  ListTeamMembersQuery,
  PromoteTeamMemberBody,
  UpdateTeamMemberBody,
} from "~/schemas/team-member-schemas";
import { assertStepUpToken } from "~/services/step-up-auth-service";
import type { TokenPayload } from "~/types";

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
    const existing = await prisma.user.findFirst({
      where: employeeIdWhere(employeeId),
    });
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
  const appUrl = getAppBaseUrl();
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
    prisma.user.findUnique({ where: userEmailWhere(email) }),
    prisma.facility.findUnique({ where: facilityEmailWhere(email) }),
  ]);

  if (emailFacility || (emailUser && emailUser.id !== excludeUserId)) {
    throw new HttpError(
      "An account with this email already exists",
      HttpStatus.CONFLICT,
    );
  }
}

function permissionsChanged(current: string[], next: string[]) {
  const left = normalizeTeamPermissions(current).slice().sort().join(",");
  const right = normalizeTeamPermissions(next).slice().sort().join(",");
  return left !== right;
}

export async function createTeamMember(
  actor: TokenPayload,
  input: CreateTeamMemberBody,
) {
  assertStepUpToken(actor, input.stepUpToken);

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
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = search
    ? members.filter((member) =>
        recordMatchesSearch(member, search, [
          "firstName",
          "lastName",
          "email",
          "employeeId",
          "phone",
        ]),
      )
    : members;

  return filtered.map(publicTeamMember);
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

export async function updateTeamMember(
  actor: TokenPayload,
  id: string,
  input: UpdateTeamMemberBody,
) {
  const member = await getTeamMemberOrThrow(id);
  const permissions = normalizeTeamPermissions(input.permissions);

  if (permissionsChanged(member.permissions, permissions)) {
    if (!input.stepUpToken) {
      throw new HttpError(
        "Step-up authentication is required to change permissions",
        HttpStatus.FORBIDDEN,
      );
    }
    assertStepUpToken(actor, input.stepUpToken);
  }

  const email = input.email.toLowerCase();
  const { firstName, lastName } = splitName(input.name);

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

export async function promoteTeamMemberToAdmin(
  actor: TokenPayload,
  id: string,
  input: PromoteTeamMemberBody,
  ctx: AuditRequestContext,
) {
  assertStepUpToken(actor, input.stepUpToken);

  const member = await getTeamMemberOrThrow(id);

  if (member.id === actor.id) {
    throw new HttpError(
      "You cannot change your own admin role through this action",
      HttpStatus.BAD_REQUEST,
    );
  }

  const updated = await prisma.user.update({
    where: { id: member.id },
    data: {
      role: UserRole.ADMIN,
      permissions: [],
    },
  });

  const actorUser = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { email: true },
  });

  await recordSecurityAuditEvent({
    eventType: SECURITY_AUDIT_EVENTS.ADMIN_PROMOTED,
    actorId: actor.id,
    actorRole: actor.role,
    actorEmail: actorUser?.email ?? "unknown",
    targetResource: formatAuditTargetResource("user", updated.id),
    context: ctx,
  });

  return {
    id: updated.id,
    email: updated.email,
    name: `${updated.firstName} ${updated.lastName}`.trim(),
    role: updated.role,
  };
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

  await invalidateUserCredentials(updated.id, updated.role);

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

export async function resendTeamMemberInvite(id: string) {
  const member = await getTeamMemberOrThrow(id);

  if (member.status !== UserStatus.ACTIVE) {
    throw new HttpError(
      "Activate the team member before resending the invite",
      HttpStatus.BAD_REQUEST,
    );
  }

  if (member.passwordSetAt) {
    throw new HttpError(
      "This team member already set a password",
      HttpStatus.BAD_REQUEST,
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { invitedAt: new Date() },
  });

  const emailSent = await sendTeamMemberInvite(updated);

  return {
    member: publicTeamMember(updated),
    emailSent,
  };
}
