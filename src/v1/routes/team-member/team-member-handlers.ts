import { status as HttpStatus } from "http-status";
import { asyncHandler } from "~/lib/async-handler";
import type {
  CreateTeamMemberBody,
  ListTeamMembersQuery,
  TeamMemberIdParams,
  UpdateTeamMemberBody,
} from "~/schemas/team-member-schemas";
import * as teamMemberService from "~/services/team-member-service";

export const createTeamMemberHandler = asyncHandler<CreateTeamMemberBody>(
  async (req, res) => {
    const result = await teamMemberService.createTeamMember(req.body);
    return res.status(HttpStatus.CREATED).json({
      message: result.emailSent
        ? "Invite link sent to the team member"
        : "Team member created. Invite email could not be sent — check server logs.",
      data: result.member,
    });
  },
);

export const listTeamMembersHandler = asyncHandler<
  Record<string, never>,
  Record<string, never>,
  ListTeamMembersQuery
>(async (req, res) => {
  const data = await teamMemberService.listTeamMembers(req.query);
  return res.status(HttpStatus.OK).json({
    message: "Team members fetched successfully",
    data,
  });
});

export const getTeamMemberHandler = asyncHandler<
  Record<string, never>,
  TeamMemberIdParams
>(async (req, res) => {
  const data = await teamMemberService.getTeamMember(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Team member fetched successfully",
    data,
  });
});

export const updateTeamMemberHandler = asyncHandler<
  UpdateTeamMemberBody,
  TeamMemberIdParams
>(async (req, res) => {
  const data = await teamMemberService.updateTeamMember(req.params.id, req.body);
  return res.status(HttpStatus.OK).json({
    message: "Team member updated successfully",
    data,
  });
});

export const blockTeamMemberHandler = asyncHandler<
  Record<string, never>,
  TeamMemberIdParams
>(async (req, res) => {
  const data = await teamMemberService.blockTeamMember(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Team member deactivated successfully",
    data,
  });
});

export const unblockTeamMemberHandler = asyncHandler<
  Record<string, never>,
  TeamMemberIdParams
>(async (req, res) => {
  const data = await teamMemberService.unblockTeamMember(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: "Team member activated successfully",
    data,
  });
});

export const resendTeamMemberInviteHandler = asyncHandler<
  Record<string, never>,
  TeamMemberIdParams
>(async (req, res) => {
  const result = await teamMemberService.resendTeamMemberInvite(req.params.id);
  return res.status(HttpStatus.OK).json({
    message: result.emailSent
      ? "Invite link resent to the team member"
      : "Invite could not be sent — check server logs.",
    data: result.member,
  });
});
