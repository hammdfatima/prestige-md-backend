import type { Facility, User } from "~/generated/prisma/client";

export type LoginAccountRef =
  | {
      kind: "user";
      record: Pick<User, "id" | "email" | "firstName" | "lastName" | "role">;
    }
  | {
      kind: "facility";
      record: Pick<Facility, "id" | "email" | "managerName">;
    };

export type LoginNotificationContext = {
  ipAddress?: string;
  userAgent?: string;
};
