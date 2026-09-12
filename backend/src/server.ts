import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { authRouter } from './routes/auth';
import { kitRouter } from './routes/kits';
import { errorHandler, notFound } from './middleware/errors';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-interview-prep';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.disable('x-powered-by');
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/kits', kitRouter);
app.use(notFound);
app.use(errorHandler);

async function start() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
  }

  await mongoose.connect(MONGO_URI);
  console.log('[Database] Connected');
  app.listen(PORT, () => console.log(`[Server] Listening on ${PORT}`));
}

start().catch((error) => {
  console.error(`[Startup] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

export default app;
