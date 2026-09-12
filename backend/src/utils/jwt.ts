import crypto from 'crypto';

interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function sign(input: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

export function createAccessToken(userId: string, email: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ sub: userId, email, iat: now, exp: now + ttlSeconds }));
  const input = `${header}.${payload}`;
  return `${input}.${sign(input, getJwtSecret())}`;
}

export function verifyAccessToken(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`, getJwtSecret());
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error('Invalid token');
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload;
  if (!decoded.sub || !decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired token');
  }
  return decoded;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be configured with at least 32 characters');
  return 'development-only-secret-change-before-deployment-1234567890';
}
