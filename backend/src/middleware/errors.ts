import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', details: err.issues.map((issue) => issue.message) });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  console.error(`[Error] ${req.method} ${req.path}: ${message}`);
  res.status(500).json({ error: 'Internal server error' });
}
