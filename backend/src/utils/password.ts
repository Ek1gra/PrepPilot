import crypto from 'crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  }).toString('hex');
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELISM}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, cost, blockSize, parallelism, salt, expected] = stored.split('$');
  if (algorithm !== 'scrypt' || !cost || !blockSize || !parallelism || !salt || !expected) return false;

  try {
    const actual = crypto.scryptSync(password, salt, KEY_LENGTH, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelism),
    });
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}
