import type { Response } from 'express';
import { z } from 'zod';

export function requireById<T>(
  res: Response,
  repo: { getById: (id: number) => T | null | undefined },
  id: number,
  notFoundMsg: string,
): boolean {
  if (!repo.getById(id)) {
    res.status(404).json({ error: notFoundMsg });
    return false;
  }
  return true;
}

export function parseBody<T>(res: Response, schema: z.ZodType<T>, body: unknown): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return null;
  }
  return parsed.data;
}
