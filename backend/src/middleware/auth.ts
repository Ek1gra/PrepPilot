import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const cookieToken = parseCookies(req.headers.cookie || '').auth_token;
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = cookieToken || bearerToken;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  const sameSite = process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'None' : 'Lax');
  return `auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Max-Age=604800; SameSite=${sameSite};${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  const sameSite = process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'None' : 'Lax');
  return `auth_token=; Path=/; HttpOnly; Max-Age=0; SameSite=${sameSite};${secure}`;
}
