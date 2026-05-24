import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis');
export const optionalDateSchema = dateSchema.nullable().default(null);
