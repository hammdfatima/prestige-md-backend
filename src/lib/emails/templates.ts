import type { OutboundEmail } from "~/lib/mailer"
import {
  emailButton,
  emailCodeBlock,
  emailDetailList,
  escapeHtml,
  wrapHtml,
} from "~/lib/emails/layout"

export function buildPasswordResetOtpEmail(input: {
  name: string
  email: string
  code: string
}): OutboundEmail {
  const subject = "Your PrestigeMD password reset code"
  const text = [
    `Hi ${input.name},`,
    "",
    "Use this code to reset your PrestigeMD password:",
    input.code,
    "",
    "This code expires in 10 minutes.",
    "If you did not request a reset, you can ignore this email.",
  ].join("\n")

  const html = wrapHtml(
    "Password reset code",
    `
    <p style="margin:0 0 12px">Hi ${escapeHtml(input.name)},</p>
    <p style="margin:0 0 8px">Use this code to reset your PrestigeMD password. Enter it on the reset screen along with your new password.</p>
    ${emailCodeBlock(input.code)}
    <p style="margin:0 0 12px">This code expires in <strong>10 minutes</strong>.</p>
    <p style="margin:0;color:#64748b;font-size:13px">If you did not request a reset, you can safely ignore this email.</p>
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
