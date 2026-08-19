import bcrypt from "bcrypt";

export function hashedPass(password: string): string {
  const hashedPassword = bcrypt.hashSync(password, 10);
  return hashedPassword;
}

export function comparePassword({
  password,
  hash,
}: { password: string; hash: string }): boolean {
  const compare = bcrypt.compareSync(password, hash);
  return compare;
}
