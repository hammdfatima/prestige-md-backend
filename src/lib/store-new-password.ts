import { hashedPass } from "~/lib/bycrpt";
import { assertStrongPassword } from "~/lib/password";

/** Hash a newly chosen password after enforcing the shared password policy. */
export async function storeNewPassword(password: string): Promise<string> {
  assertStrongPassword(password);
  return hashedPass(password);
}
