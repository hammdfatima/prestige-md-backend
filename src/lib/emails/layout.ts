import env from "~/env"

/** Brand colors aligned with the PrestigeMD app theme. */
const BRAND = {
  primary: "#001a57",
  secondary: "#2a7ac4",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  surface: "#f8fafc",
  white: "#ffffff",
  pageBg: "#eef2f7",
} as const

/** Content-ID used when the logo is attached inline by the mailer. */
export const EMAIL_LOGO_CID = "prestige-md-logo"

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Prefer a public CDN URL when configured; otherwise use the inline CID
 * attachment so the logo works even with a localhost APP_URL.
 */
export function emailLogoSrc() {
  const configured = env.EMAIL_LOGO_URL?.trim()
  if (configured) {
    return configured
  }
  return `cid:${EMAIL_LOGO_CID}`
}

export function emailButton(href: string, label: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px">
    <tr>
      <td align="center" bgcolor="${BRAND.primary}" style="border-radius:12px;background-color:${BRAND.primary}">
        <a href="${escapeHtml(href)}"
           style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:${BRAND.white};text-decoration:none;border-radius:12px">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`
}

export function emailDetailList(
  rows: Array<{ label: string; value: string }>,
) {
  const items = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};width:110px;vertical-align:top">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.text};font-weight:600;vertical-align:top">
          ${escapeHtml(row.value)}
        </td>
      </tr>`,
    )
    .join("")

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="margin:20px 0;background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px">
    <tr>
      <td style="padding:4px 18px 4px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${items}
        </table>
      </td>
    </tr>
  </table>`
}

export function emailCodeBlock(code: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0">
    <tr>
      <td align="center" style="background-color:${BRAND.surface};border:1px dashed ${BRAND.secondary};border-radius:14px;padding:22px 16px">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.muted}">
          Your code
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:700;letter-spacing:0.28em;color:${BRAND.primary}">
          ${escapeHtml(code)}
        </p>
      </td>
    </tr>
  </table>`
}

/**
 * Shared PrestigeMD email chrome: logo header, card body, footer.
 * Uses table layout for broad email-client compatibility.
 */
export function wrapHtml(title: string, body: string) {
  const logo = emailLogoSrc()
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.pageBg}">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px">
          <tr>
            <td align="center" style="padding:0 0 20px">
              <img src="${escapeHtml(logo)}"
                   alt="PrestigeMD"
                   width="160"
                   style="display:block;width:160px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none" />
            </td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08)">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-size:0;line-height:0">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="60%" height="4" bgcolor="${BRAND.primary}" style="background-color:${BRAND.primary};font-size:0;line-height:0">&nbsp;</td>
                        <td width="40%" height="4" bgcolor="${BRAND.secondary}" style="background-color:${BRAND.secondary};font-size:0;line-height:0">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.secondary};font-weight:700">
                      PrestigeMD
                    </p>
                    <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${BRAND.primary};font-weight:700">
                      ${escapeHtml(title)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.text}">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted}">
              <p style="margin:0 0 6px">This message was sent by PrestigeMD.</p>
              <p style="margin:0">&copy; ${year} PrestigeMD. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
