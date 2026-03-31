import { z } from 'zod';

// ─── Create (used in onboarding) ─────────────────────────────────────────────
export const CreateBusinessSchema = z.object({
  name:         z.string().min(2).max(100),
  businessType: z.enum(['retail', 'restaurant', 'school', 'pharmacy', 'service']),
  country:      z.string().length(2),          // ISO 3166-1 alpha-2 e.g. 'MM', 'US'
  currency:     z.string().length(3),          // ISO 4217 e.g. 'MMK', 'USD'
  language:     z.enum(['en', 'my']).default('en'),
  email:        z.string().email(),
  phone:        z.string().optional(),
});
export type CreateBusinessDto = z.infer<typeof CreateBusinessSchema>;

// ─── Update ───────────────────────────────────────────────────────────────────
export const UpdateBusinessSchema = z.object({
  name:            z.string().min(2).max(100).optional(),
  phone:           z.string().optional(),
  address:         z.string().optional(),
  logoUrl:         z.string().url().optional(),
  defaultLanguage: z.enum(['en', 'my']).optional(),
});
export type UpdateBusinessDto = z.infer<typeof UpdateBusinessSchema>;

// ─── Type selection (onboarding step 3) ──────────────────────────────────────
export const SelectTypeSchema = z.object({
  businessType: z.enum(['retail', 'restaurant', 'school', 'pharmacy', 'service']),
});
export type SelectTypeDto = z.infer<typeof SelectTypeSchema>;

// ─── Plan selection (onboarding step 4) ──────────────────────────────────────
export const SelectPlanSchema = z.object({
  plan: z.enum(['trial', 'starter', 'growth', 'enterprise']),
});
export type SelectPlanDto = z.infer<typeof SelectPlanSchema>;
