import { Router } from "express";
import AUTH_ROUTER from "~/v1/routes/auth/auth-routes";
import FACILITY_ROUTER from "~/v1/routes/facility/facility-routes";
import FILES_ROUTER from "~/v1/routes/files/files-routes";
import NURSE_ROUTER from "~/v1/routes/nurse/nurse-routes";
import PATIENT_ROUTER from "~/v1/routes/patient/patient-routes";
import PROVIDER_ROUTER from "~/v1/routes/provider/provider-routes";
import TEAM_MEMBER_ROUTER from "~/v1/routes/team-member/team-member-routes";
import VISIT_ROUTER from "~/v1/routes/visit/visit-routes";

const MAIN_ROUTER = Router();
MAIN_ROUTER.use("/auth", AUTH_ROUTER);
MAIN_ROUTER.use("/facilities", FACILITY_ROUTER);
MAIN_ROUTER.use("/nurses", NURSE_ROUTER);
MAIN_ROUTER.use("/providers", PROVIDER_ROUTER);
MAIN_ROUTER.use("/patients", PATIENT_ROUTER);
MAIN_ROUTER.use("/team-members", TEAM_MEMBER_ROUTER);
MAIN_ROUTER.use("/visits", VISIT_ROUTER);
MAIN_ROUTER.use("/files", FILES_ROUTER);

export default MAIN_ROUTER;
