import { Router } from "express";
import { UserRole } from "~/generated/prisma/client";
import { requireAuth } from "~/middlewares/auth";
import { schemaParseMiddleWare } from "~/middlewares/zod-validator";
import {
  createTeamMemberSchema,
  listTeamMembersQuerySchema,
  promoteTeamMemberSchema,
  teamMemberIdParamsSchema,
  updateTeamMemberSchema,
} from "~/schemas/team-member-schemas";
import {
  blockTeamMemberHandler,
  createTeamMemberHandler,
  getTeamMemberHandler,
  listTeamMembersHandler,
  promoteTeamMemberHandler,
  resendTeamMemberInviteHandler,
  unblockTeamMemberHandler,
  updateTeamMemberHandler,
} from "~/v1/routes/team-member/team-member-handlers";

const TEAM_MEMBER_ROUTER = Router();

TEAM_MEMBER_ROUTER.use(requireAuth(UserRole.ADMIN));

TEAM_MEMBER_ROUTER.post(
  "/",
  schemaParseMiddleWare(createTeamMemberSchema),
  createTeamMemberHandler,
);

TEAM_MEMBER_ROUTER.get(
  "/",
  schemaParseMiddleWare(listTeamMembersQuerySchema, "query"),
  listTeamMembersHandler,
);

TEAM_MEMBER_ROUTER.get(
  "/:id",
  schemaParseMiddleWare(teamMemberIdParamsSchema, "params"),
  getTeamMemberHandler,
);

TEAM_MEMBER_ROUTER.patch(
  "/:id",
  schemaParseMiddleWare(teamMemberIdParamsSchema, "params"),
  schemaParseMiddleWare(updateTeamMemberSchema),
  updateTeamMemberHandler,
);

TEAM_MEMBER_ROUTER.post(
  "/:id/promote-admin",
  schemaParseMiddleWare(teamMemberIdParamsSchema, "params"),
  schemaParseMiddleWare(promoteTeamMemberSchema),
  promoteTeamMemberHandler,
);

TEAM_MEMBER_ROUTER.patch(
  "/:id/block",
  schemaParseMiddleWare(teamMemberIdParamsSchema, "params"),
  blockTeamMemberHandler,
);

TEAM_MEMBER_ROUTER.patch(
  "/:id/unblock",
  schemaParseMiddleWare(teamMemberIdParamsSchema, "params"),
  unblockTeamMemberHandler,
);

TEAM_MEMBER_ROUTER.post(
  "/:id/resend-invite",
  schemaParseMiddleWare(teamMemberIdParamsSchema, "params"),
  resendTeamMemberInviteHandler,
);

export default TEAM_MEMBER_ROUTER;
