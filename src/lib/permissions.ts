/** HIPAA §2.1 role-based access control — default-deny permission matrix. */
import { UserRole } from "~/generated/prisma/client";

/** Granular permissions for admin/staff (TEAM_MEMBER) roles. */
export const TEAM_PERMISSIONS = [
  "view_dashboard",
  "manage_doctors",
  "manage_patients",
  "manage_nurses",
  "manage_appointments",
  "manage_facilities",
  "view_audit_trail",
] as const;

export type TeamPermissionId = (typeof TEAM_PERMISSIONS)[number];

const LEGACY_PATIENT_PERMISSIONS = new Set([
  "view_patients",
  "add_patients",
  "update_patients",
  "remove_patients",
]);

const permissionSet = new Set<string>(TEAM_PERMISSIONS);

/**
 * Permission matrix — maps functional areas to required team permissions.
 * ADMIN bypasses all checks. Other roles use role-based route middleware.
 */
export const PERMISSION_MATRIX = {
  dashboard: ["view_dashboard"],
  patients: {
    read: ["manage_patients"],
    write: ["manage_patients"],
  },
  providers: {
    read: ["manage_doctors"],
    write: ["manage_doctors"],
  },
  nurses: {
    read: ["manage_nurses"],
    write: ["manage_nurses"],
  },
  visits: {
    read: ["manage_appointments"],
  },
  facilities: {
    read: [
      "manage_facilities",
      "manage_nurses",
      "manage_doctors",
      "manage_patients",
    ],
    write: ["manage_facilities"],
  },
  auditTrail: ["view_audit_trail"],
  providerAvailability: ["manage_appointments", "manage_doctors"],
} as const satisfies Record<
  string,
  TeamPermissionId[] | Record<string, TeamPermissionId[]>
>;

export function isTeamPermissionId(value: string): value is TeamPermissionId {
  return permissionSet.has(value);
}

export function normalizeTeamPermissions(input: string[]): TeamPermissionId[] {
  const next = new Set<TeamPermissionId>();

  for (const permission of input) {
    if (isTeamPermissionId(permission)) {
      next.add(permission);
      continue;
    }
    if (LEGACY_PATIENT_PERMISSIONS.has(permission)) {
      next.add("manage_patients");
    }
  }

  return TEAM_PERMISSIONS.filter((permission) => next.has(permission));
}

type PermissionSubject = {
  role: UserRole;
  permissions?: string[];
};

/** Default-deny permission check for TEAM_MEMBER; ADMIN always allowed. */
export function hasTeamPermission(
  subject: PermissionSubject,
  ...anyOf: TeamPermissionId[]
): boolean {
  if (subject.role === UserRole.ADMIN) {
    return true;
  }

  if (subject.role !== UserRole.TEAM_MEMBER) {
    return false;
  }

  const granted = new Set(subject.permissions ?? []);
  return anyOf.some((permission) => granted.has(permission));
}
