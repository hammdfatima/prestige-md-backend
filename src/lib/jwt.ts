import jwt, { type SignOptions } from "jsonwebtoken";
import env from "~/env";
import logger from "~/lib/logger";
import type { TokenPayload } from "~/types";

const createToken = (
  payload: TokenPayload,
  expiresIn: SignOptions["expiresIn"] = "1d",
): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (error) {
    logger.error(error);
    throw new Error("Invalid Token");
  }
};

export { createToken, verifyToken };
