import jwt from "jsonwebtoken";
import env from "~/env";
import {
  emailButton,
  escapeHtml,
  wrapHtml,
} from "~/lib/emails/layout";

const FACILITY_INVITE_TYPE = "facility_invite";
const STAFF_INVITE_TYPE = "staff_invite";

export function createFacilityInviteToken(input: {
  facilityId: string;
  email: string;
}) {
  return jwt.sign(
    {
      ...input,
      type: FACILITY_INVITE_TYPE,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function createStaffInviteToken(input: {
  userId: string;
  email: string;
}) {
  return jwt.sign(
    {
      ...input,
      type: STAFF_INVITE_TYPE,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function readInviteType(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
    type?: string;
  };

  if (payload.type === FACILITY_INVITE_TYPE || payload.type === STAFF_INVITE_TYPE) {
    return payload.type;
  }

  throw new Error("Invalid invite token");
}

export function verifyFacilityInviteToken(token: string): {
  facilityId: string;
  email: string;
} {
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
    type?: string;
    facilityId?: string;
    email?: string;
  };

  if (
    payload.type !== FACILITY_INVITE_TYPE ||
    typeof payload.facilityId !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Invalid invite token");
  }

  return {
    facilityId: payload.facilityId,
    email: payload.email.toLowerCase(),
  };
}

export function verifyStaffInviteToken(token: string): {
  userId: string;
  email: string;
} {
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
    type?: string;
    userId?: string;
    email?: string;
  };

  if (
    payload.type !== STAFF_INVITE_TYPE ||
    typeof payload.userId !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Invalid invite token");
  }

  return {
    userId: payload.userId,
    email: payload.email.toLowerCase(),
  };
}

export function buildFacilityInviteEmail(input: {
  managerName: string;
  facilityName: string;
  email: string;
  inviteUrl: string;
}) {
  const subject = `You're invited to manage ${input.facilityName} on PrestigeMD`;
  const text = [
    `Hi ${input.managerName},`,
    "",
    `You've been invited to manage ${input.facilityName} on PrestigeMD.`,
    "Set your password using this link (expires in 7 days):",
    input.inviteUrl,
    "",
    "If you were not expecting this invite, you can ignore this email.",
  ].join("\n");

  const html = wrapHtml(
    "You're invited",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.managerName)},</p>
    <p style="margin:0">You've been invited to manage <strong>${escapeHtml(input.facilityName)}</strong> on PrestigeMD.</p>
    ${emailButton(input.inviteUrl, "Set your password")}
    <p style="margin:16px 0 0;color:#64748b;font-size:13px">This link expires in <strong>7 days</strong>. If you were not expecting this invite, you can ignore this email.</p>
  `,
  );

  return {
    to: input.email,
    subject,
    text,
    html,
  };
}

export function buildStaffInviteEmail(input: {
  name: string;
  roleLabel: string;
  facilityName: string;
  email: string;
  inviteUrl: string;
}) {
  const subject = `You're invited to join ${input.facilityName} on PrestigeMD`;
  const text = [
    `Hi ${input.name},`,
    "",
    `You've been invited as a ${input.roleLabel} at ${input.facilityName} on PrestigeMD.`,
    "Set your password using this link (expires in 7 days):",
    input.inviteUrl,
    "",
    "If you were not expecting this invite, you can ignore this email.",
  ].join("\n");

  const html = wrapHtml(
    "You're invited",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.name)},</p>
    <p style="margin:0">You've been invited as a <strong>${escapeHtml(input.roleLabel)}</strong> at <strong>${escapeHtml(input.facilityName)}</strong> on PrestigeMD.</p>
    ${emailButton(input.inviteUrl, "Set your password")}
    <p style="margin:16px 0 0;color:#64748b;font-size:13px">This link expires in <strong>7 days</strong>. If you were not expecting this invite, you can ignore this email.</p>
  `,
  );

  return {
    to: input.email,
    subject,
    text,
    html,
  };
}
