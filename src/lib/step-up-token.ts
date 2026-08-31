import jwt from "jsonwebtoken";
import env from "~/env";

export const STEP_UP_TOKEN_TTL_SECONDS = 5 * 60;

export type StepUpTokenPayload = {
  id: string;
  stepUp: true;
};

export function createStepUpToken(userId: string): string {
  return jwt.sign({ id: userId, stepUp: true }, env.JWT_SECRET, {
    expiresIn: STEP_UP_TOKEN_TTL_SECONDS,
  });
}

export function isValidStepUpToken(
  token: string,
  userId: string,
): boolean {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as StepUpTokenPayload;
    return payload.stepUp === true && payload.id === userId;
  } catch {
    return false;
  }
}
