import { Router } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/user';
import { asyncHandler } from '../utils/asyncHandler';
import { hashPassword, verifyPassword } from '../utils/password';
import { createAccessToken } from '../utils/jwt';
import { AuthenticatedRequest, clearSessionCookie, requireAuth, sessionCookie } from '../middleware/auth';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

authRouter.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const existing = await UserModel.exists({ email });
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const user = await UserModel.create({ email, passwordHash: hashPassword(password) });
  const token = createAccessToken(user._id.toString(), user.email);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.status(201).json({ user: { id: user._id.toString(), email: user.email } });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const user = await UserModel.findOne({ email });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = createAccessToken(user._id.toString(), user.email);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ user: { id: user._id.toString(), email: user.email } });
}));

authRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(204).send();
});

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const user = await UserModel.findById(authReq.user.id).select('_id email');
  if (!user) {
    res.status(401).json({ error: 'Session user no longer exists' });
    return;
  }
  res.json({ user: { id: user._id.toString(), email: user.email } });
}));
