/** HIPAA §3.2 append-only audit — Postgres triggers reject UPDATE/DELETE. */
import prisma from "~/lib/db";
import logger from "~/lib/logger";

const APPEND_ONLY_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION prevent_security_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
`;

const APPEND_ONLY_TRIGGER_SQL = `
DROP TRIGGER IF EXISTS security_audit_events_no_update ON security_audit_events;
CREATE TRIGGER security_audit_events_no_update
  BEFORE UPDATE ON security_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_security_audit_event_mutation();

DROP TRIGGER IF EXISTS security_audit_events_no_delete ON security_audit_events;
CREATE TRIGGER security_audit_events_no_delete
  BEFORE DELETE ON security_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_security_audit_event_mutation();
`;

/** Enforce append-only audit storage at the database level. */
export async function ensureSecurityAuditAppendOnlyGuards() {
  try {
    await prisma.$executeRawUnsafe(APPEND_ONLY_FUNCTION_SQL);
    await prisma.$executeRawUnsafe(APPEND_ONLY_TRIGGER_SQL);
    logger.info("Security audit append-only database guards are active");
  } catch (error) {
    logger.error("Failed to apply security audit append-only database guards");
    logger.error(error);
  }
}
