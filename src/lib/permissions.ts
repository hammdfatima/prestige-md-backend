export const TEAM_PERMISSIONS = [
  "view_dashboard",
  "manage_doctors",
  "manage_patients",
  "manage_nurses",
  "manage_appointments",
  "manage_facilities",
] as const;

export type TeamPermissionId = (typeof TEAM_PERMISSIONS)[number];

const LEGACY_PATIENT_PERMISSIONS = new Set([
  "view_patients",
  "add_patients",
  "update_patients",
  "remove_patients",
]);

const permissionSet = new Set<string>(TEAM_PERMISSIONS);

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
