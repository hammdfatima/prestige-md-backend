import env from "~/env"
import logger from "~/lib/logger"

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000

let keepAliveTimer: NodeJS.Timeout | null = null

function resolveKeepAliveUrl() {
  const configured = env.KEEP_ALIVE_URL?.replace(/\/+$/, "")
  if (configured) {
    return `${configured}/api/health`
  }

  // Render injects this for web services.
  /* eslint-disable node/no-process-env */
  const renderUrl = process.env.RENDER_EXTERNAL_URL?.replace(/\/+$/, "")
  /* eslint-enable node/no-process-env */
  if (renderUrl) {
    return `${renderUrl}/api/health`
  }

  return null
}

async function ping() {
  const url = resolveKeepAliveUrl()
  if (!url) {
    return
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "user-agent": "prestige-md-keep-alive" },
      signal: AbortSignal.timeout(15_000),
    })
    logger.info(`Keep-alive ping ${response.status}: ${url}`)
  } catch (error) {
    logger.warn(`Keep-alive ping failed: ${url}`)
    logger.error(error)
  }
}

/**
 * Pings the public health URL every 10 minutes so Render free-tier
 * instances are less likely to sleep from inactivity.
 * Pair with the GitHub scheduled workflow for cold starts.
 */
export function startKeepAliveJob() {
  if (keepAliveTimer) {
    return
  }

  if (!resolveKeepAliveUrl()) {
    logger.info(
      "Keep-alive skipped (set KEEP_ALIVE_URL or deploy on Render)",
    )
    return
  }

  const tick = () => {
    void ping()
  }

  tick()
  keepAliveTimer = setInterval(tick, KEEP_ALIVE_INTERVAL_MS)
  logger.info("Keep-alive job started (every 10 minutes)")
}
