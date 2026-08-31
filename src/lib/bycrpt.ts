import bcrypt from "bcrypt";

/** Target ~200–300ms per hash on typical server hardware. */
export const BCRYPT_COST_ROUNDS = 12;

export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST_ROUNDS;
  } catch {
    return true;
  }
}

export async function hashedPass(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST_ROUNDS);
}

/** Constant-time compare via bcrypt — never compare hashes with == or ===. */
export async function comparePassword({
  password,
  hash,
}: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
