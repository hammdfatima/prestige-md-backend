import { emailLookupHash, hashLookupValue } from "~/lib/field-encryption";

export function userEmailWhere(email: string) {
  return { emailLookupHash: emailLookupHash(email) };
}

export function facilityEmailWhere(email: string) {
  return { emailLookupHash: emailLookupHash(email) };
}

export function patientEmailWhere(email: string) {
  return { emailLookupHash: emailLookupHash(email) };
}

export function employeeIdWhere(employeeId: string) {
  return { employeeIdLookupHash: hashLookupValue(employeeId.trim()) };
}

export function securityAuditActorEmailWhere(email: string) {
  return { actorEmailLookupHash: emailLookupHash(email) };
}
