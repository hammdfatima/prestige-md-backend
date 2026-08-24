import fs from "node:fs"
import path from "node:path"
import { Resend } from "resend"
import env from "~/env"
import { EMAIL_LOGO_CID, emailLogoSrc } from "~/lib/emails/layout"
import logger from "~/lib/logger"

export type OutboundEmail = {
  to: string
  subject: string
  text: string
  html: string
}

function logEmailForTesting(email: OutboundEmail, reason: string) {
  logger.warn(`Email not sent (${reason}). Logging content for testing:`)
  logger.info(
    [
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      "----- TEXT -----",
      email.text,
      "----- HTML -----",
      email.html,
    ].join("\n"),
  )
}

function resolveEmailLogoPath() {
  const candidates = [
    path.resolve(process.cwd(), "assets", "email-logo.png"),
    path.resolve(process.cwd(), "src", "assets", "email-logo.png"),
    path.resolve(__dirname, "..", "..", "assets", "email-logo.png"),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function emailLogoAttachment() {
  // When a public logo URL is configured, HTML already points there.
  if (!emailLogoSrc().startsWith("cid:")) {
    return null
  }

  const logoPath = resolveEmailLogoPath()
  if (!logoPath) {
    logger.warn("Email logo asset missing; sending without inline logo")
    return null
  }

  return {
    filename: "email-logo.png",
    content: fs.readFileSync(logoPath),
    contentId: EMAIL_LOGO_CID,
    contentType: "image/png",
  }
}

export async function sendEmail(email: OutboundEmail): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    logEmailForTesting(email, "RESEND_API_KEY is not configured")
    return false
  }

  const fromRaw = env.EMAIL_FROM ?? "PrestigeMD <onboarding@resend.dev>"
  const from = fromRaw.includes("<") ? fromRaw : `PrestigeMD <${fromRaw}>`

  try {
    const resend = new Resend(env.RESEND_API_KEY)
    const logoAttachment = emailLogoAttachment()

    const { error } = await resend.emails.send({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
    })

    if (error) {
      logger.error(error)
      logEmailForTesting(email, error.message ?? "Resend send failed")
      return false
    }

    logger.info(`Email sent to ${email.to}: ${email.subject}`)
    return true
  } catch (error) {
    logger.error(error)
    logEmailForTesting(email, "Resend send failed")
    return false
  }
}
