import { createLogger, format, transports } from "winston";
import { blue, yellow, red, green } from "colorette";
import { sanitizeLogMessage } from "~/lib/sanitize-for-log";

const colors = {
  info: blue,
  warn: yellow,
  error: red,
  debug: green,
};

const colorizeFormat = format.printf(({ level, message }) => {
  const safeMessage = sanitizeLogMessage(message);
  const colorFn = colors[level as keyof typeof colors];
  if (colorFn) {
    return colorFn(`[${level.toUpperCase()}] ${safeMessage}`);
  }
  return `[${level.toUpperCase()}] ${safeMessage}`;
});

const logger = createLogger({
  level: "debug",
  format: format.combine(format.timestamp(), colorizeFormat),
  transports: [new transports.Console()],
});

export default logger;
