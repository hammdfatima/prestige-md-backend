import { Resend } from "resend";
import env from "~/env";
import logger from "~/lib/logger";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function logEmailForTesting(email: OutboundEmail, reason: string) {
  logger.warn(`Email not sent (${reason}). Logging content for testing:`);
  logger.info(
    [
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      "----- TEXT -----",
      email.text,
      "----- HTML -----",
      email.html,
    ].join("\n"),
  );
}

export async function sendEmail(email: OutboundEmail): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    logEmailForTesting(email, "RESEND_API_KEY is not configured");
    return false;
  }

  const from = env.EMAIL_FROM ?? "PrestigeMD <onboarding@resend.dev>";

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (error) {
      logger.error(error);
      logEmailForTesting(email, error.message ?? "Resend send failed");
      return false;
    }

    logger.info(`Email sent to ${email.to}: ${email.subject}`);
    return true;
  } catch (error) {
    logger.error(error);
    logEmailForTesting(email, "Resend send failed");
    return false;
  }
}
