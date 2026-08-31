import { InContextConsentType } from "~/generated/prisma/client";

export const IN_CONTEXT_CONSENT_POLICY_VERSION = "v1";

export const IN_CONTEXT_CONSENT_POLICIES = {
  [InContextConsentType.TELEHEALTH_SESSION]: {
    version: IN_CONTEXT_CONSENT_POLICY_VERSION,
    title: "Telehealth session disclaimer",
    points: [
      "This video visit may be recorded or logged for care coordination and compliance. Do not record the session on personal devices unless your organization policy allows it.",
      "Discuss only information needed for this visit. Ensure you are in a private location where others cannot overhear patient information.",
      "Do not join from public or unsecured Wi-Fi when possible. Use a trusted network or VPN to reduce interception risk.",
      "If connectivity drops, rejoin from a secure location and confirm the patient identity before continuing clinical discussion.",
    ],
  },
  [InContextConsentType.CLINICAL_NOTES]: {
    version: IN_CONTEXT_CONSENT_POLICY_VERSION,
    title: "Clinical documentation disclaimer",
    points: [
      "Clinical notes may contain protected health information (PHI). Access and document only what is required for this patient's care.",
      "Do not view or edit notes on shared or public devices. Lock your workstation when stepping away.",
      "Avoid unsecured Wi-Fi when opening or saving clinical documentation. Prefer a trusted network or VPN.",
      "You are responsible for accurate, timely documentation. Notes may be reviewed for quality and compliance.",
    ],
  },
} as const;

export function getActivePolicyVersion(consentType: InContextConsentType) {
  return IN_CONTEXT_CONSENT_POLICIES[consentType].version;
}
