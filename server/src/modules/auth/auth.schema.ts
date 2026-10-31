import { z } from 'zod';

import { emailSchema, langSchema, usernameSchema } from '../../lib/validators.js';

export { emailSchema, usernameSchema } from '../../lib/validators.js';
export const newPasswordSchema = z.string().min(8).max(200);

export const loginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

/** `lang` : langue des données initiales du compte (catégories…). */
export const setupSchema = z.object({
  token: z.string().min(1),
  username: usernameSchema,
  password: newPasswordSchema,
  lang: langSchema,
});

export const profileSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    username: usernameSchema.optional(),
    email: emailSchema.nullable().optional(),
  })
  .refine((d) => d.username !== undefined || d.email !== undefined, {
    message: 'Au moins un champ requis',
  });

export const changePasswordSchema = z.object({
  current: z.string().min(1).max(200),
  next: newPasswordSchema,
});

const totpCodeSchema = z.string().length(6);

/** Le secret à confirmer est gardé en session par `/2fa/setup` : seul le code est envoyé. */
export const enableTotpSchema = z.object({
  code: totpCodeSchema,
});

export const disableTotpSchema = z.object({
  password: z.string().min(1).max(200),
});

export const verifyTotpSchema = z.object({
  code: totpCodeSchema,
  /** Se souvenir de cet appareil pendant 30 jours. */
  remember: z.boolean().optional().default(false),
});

export const deviceIdSchema = z.coerce.number().int().positive();

/** `lang` : langue de l'e-mail envoyé. */
export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  lang: langSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: newPasswordSchema,
});
