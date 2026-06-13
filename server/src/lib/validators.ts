import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis');
export const optionalDateSchema = dateSchema.nullable().default(null);

export const positiveAmountSchema = z.number().positive();
export const feesSchema = z.number().min(0).default(0);
export const descriptionSchema = z.string().min(1).max(200);
export const nameSchema = z.string().min(1).max(100);
