import type { OutboundEmail } from "~/lib/mailer"
import {
  emailButton,
  emailCodeBlock,
  emailDetailList,
  escapeHtml,
  wrapHtml,
} from "~/lib/emails/layout"

export function buildPasswordResetLinkEmail(input: {
  name: string
  email: string
  resetUrl: string
}): OutboundEmail {
  const subject = "Reset your PrestigeMD password"
  const text = [
    `Hi ${input.name},`,
    "",
    "We received a request to reset your PrestigeMD password.",
    "Use the secure link below to choose a new password:",
    input.resetUrl,
    "",
    "This link expires in 10 minutes.",
    "If you did not request a reset, you can ignore this email.",
  ].join("\n")

  const html = wrapHtml(
    "Reset your password",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.name)},</p>
    <p style="margin:0 0 8px">We received a request to reset your PrestigeMD password.</p>
    ${emailButton(input.resetUrl, "Reset password")}
    <p style="margin:16px 0 0;color:#64748b;font-size:13px">This link expires in <strong>10 minutes</strong>. If you did not request a reset, you can safely ignore this email.</p>
  `,
  )

  return { to: input.email, subject, text, html }
}

export function buildLoginMfaOtpEmail(input: {
  name: string
  email: string
  code: string
}): OutboundEmail {
  const subject = "Your PrestigeMD sign-in code"
  const text = [
    `Hi ${input.name},`,
    "",
    "Use this code to finish signing in to PrestigeMD:",
    input.code,
    "",
    "This code expires in 10 minutes.",
    "If you did not try to sign in, change your password and contact support.",
  ].join("\n")

  const html = wrapHtml(
    "Sign-in verification code",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.name)},</p>
    <p style="margin:0 0 8px">Enter this code to finish signing in to PrestigeMD.</p>
    ${emailCodeBlock(input.code)}
    <p style="margin:0 0 12px">This code expires in <strong>10 minutes</strong>.</p>
    <p style="margin:0;color:#64748b;font-size:13px">If you did not try to sign in, change your password and contact support.</p>
  `,
  )

  return { to: input.email, subject, text, html }
}

export function buildLoginActivityEmail(input: {
  name: string
  email: string
  deviceLabel: string
  locationLabel: string
  signedInAtLabel: string
  isNewDevice: boolean
  reportUrl: string
}): OutboundEmail {
  const subject = input.isNewDevice
    ? "New sign-in to your PrestigeMD account"
    : "Sign-in to your PrestigeMD account"
  const intro = input.isNewDevice
    ? "We noticed a sign-in to your PrestigeMD account from a new device."
    : "Your PrestigeMD account was just used to sign in."

  const text = [
    `Hi ${input.name},`,
    "",
    intro,
    `Device: ${input.deviceLabel}`,
    `Location: ${input.locationLabel}`,
    `Time: ${input.signedInAtLabel}`,
    "",
    "If this was you, no action is needed.",
    "If this wasn't you, secure your account immediately:",
    input.reportUrl,
  ].join("\n")

  const html = wrapHtml(
    input.isNewDevice ? "New sign-in detected" : "Sign-in activity",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.name)},</p>
    <p style="margin:0 0 8px">${escapeHtml(intro)}</p>
    ${emailDetailList([
      { label: "Device", value: input.deviceLabel },
      { label: "Location", value: input.locationLabel },
      { label: "Time", value: input.signedInAtLabel },
    ])}
    <p style="margin:0 0 12px">If this was you, no action is needed.</p>
    <p style="margin:0 0 8px"><strong>If this wasn't you</strong>, secure your account immediately. We'll sign out all active sessions and email you a password reset link.</p>
    ${emailButton(input.reportUrl, "This wasn't me")}
  `,
  )

  return { to: input.email, subject, text, html }
}

export function buildVisitBookedEmail(input: {
  toName: string
  toEmail: string
  patientName: string
  reason: string
  whenLabel: string
  portalUrl: string
  recipientRole: "doctor" | "nurse"
}): OutboundEmail {
  const subject = `Visit booked: ${input.patientName}`
  const roleLine =
    input.recipientRole === "doctor"
      ? "A visit has been booked for you."
      : "You booked a visit. The assigned provider has been notified."

  const text = [
    `Hi ${input.toName},`,
    "",
    roleLine,
    `Patient: ${input.patientName}`,
    `Reason: ${input.reason}`,
    `When: ${input.whenLabel}`,
    "",
    `Open portal: ${input.portalUrl}`,
  ].join("\n")

  const html = wrapHtml(
    "Visit booked",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.toName)},</p>
    <p style="margin:0">${escapeHtml(roleLine)}</p>
    ${emailDetailList([
      { label: "Patient", value: input.patientName },
      { label: "Reason", value: input.reason },
      { label: "When", value: input.whenLabel },
    ])}
    ${emailButton(input.portalUrl, "Open visit in PrestigeMD")}
  `,
  )

  return { to: input.toEmail, subject, text, html }
}

export function buildVisitReminderEmail(input: {
  toName: string
  toEmail: string
  patientName: string
  reason: string
  whenLabel: string
  portalUrl: string
}): OutboundEmail {
  const subject = `Reminder: visit with ${input.patientName} soon`
  const text = [
    `Hi ${input.toName},`,
    "",
    "This is a reminder that a visit is coming up soon.",
    `Patient: ${input.patientName}`,
    `Reason: ${input.reason}`,
    `When: ${input.whenLabel}`,
    "",
    `Open portal: ${input.portalUrl}`,
  ].join("\n")

  const html = wrapHtml(
    "Visit reminder",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.toName)},</p>
    <p style="margin:0">This is a reminder that a visit is coming up soon.</p>
    ${emailDetailList([
      { label: "Patient", value: input.patientName },
      { label: "Reason", value: input.reason },
      { label: "When", value: input.whenLabel },
    ])}
    ${emailButton(input.portalUrl, "Open visit in PrestigeMD")}
  `,
  )

  return { to: input.toEmail, subject, text, html }
}

export function buildVisitStatusEmail(input: {
  toName: string
  toEmail: string
  patientName: string
  reason: string
  whenLabel: string
  statusLabel: string
  portalUrl: string
}): OutboundEmail {
  const subject = `Visit ${input.statusLabel.toLowerCase()}: ${input.patientName}`
  const text = [
    `Hi ${input.toName},`,
    "",
    `A visit was marked as ${input.statusLabel.toLowerCase()}.`,
    `Patient: ${input.patientName}`,
    `Reason: ${input.reason}`,
    `When: ${input.whenLabel}`,
    "",
    `Open portal: ${input.portalUrl}`,
  ].join("\n")

  const html = wrapHtml(
    `Visit ${input.statusLabel.toLowerCase()}`,
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.toName)},</p>
    <p style="margin:0">A visit was marked as <strong>${escapeHtml(input.statusLabel.toLowerCase())}</strong>.</p>
    ${emailDetailList([
      { label: "Patient", value: input.patientName },
      { label: "Reason", value: input.reason },
      { label: "When", value: input.whenLabel },
      { label: "Status", value: input.statusLabel },
    ])}
    ${emailButton(input.portalUrl, "Open visit in PrestigeMD")}
  `,
  )

  return { to: input.toEmail, subject, text, html }
}
