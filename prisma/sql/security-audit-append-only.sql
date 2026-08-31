-- Append-only enforcement for security_audit_events.
-- Applied automatically on server startup via ensureSecurityAuditAppendOnlyGuards().

CREATE OR REPLACE FUNCTION prevent_security_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

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
