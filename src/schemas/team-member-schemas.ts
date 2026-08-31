import { z } from "zod";
import { TEAM_PERMISSIONS, type TeamPermissionId } from "~/lib/permissions";
import { stepUpTokenField } from "~/schemas/step-up-schemas";

const permissionEnum = z.enum(TEAM_PERMISSIONS);

const permissionsField = z
  .array(permissionEnum)
  .min(1, "Select at least one permission");

export const createTeamMemberSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  permissions: permissionsField,
  stepUpToken: stepUpTokenField,
});

export const updateTeamMemberSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  permissions: permissionsField,
  stepUpToken: stepUpTokenField.optional(),
});

export const promoteTeamMemberSchema = z.object({
  stepUpToken: stepUpTokenField,
});

export const listTeamMembersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const teamMemberIdParamsSchema = z.object({
  id: z.uuid("Invalid team member id"),
});

export type CreateTeamMemberBody = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberBody = z.infer<typeof updateTeamMemberSchema>;
export type ListTeamMembersQuery = z.infer<typeof listTeamMembersQuerySchema>;
export type TeamMemberIdParams = z.infer<typeof teamMemberIdParamsSchema>;
export type PromoteTeamMemberBody = z.infer<typeof promoteTeamMemberSchema>;
export type { TeamPermissionId };
