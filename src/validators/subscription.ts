import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────────

export const PlanSchema = z.enum(['free', 'basic', 'pro'])
export type Plan = z.infer<typeof PlanSchema>

export const SubscriptionStatusSchema = z.enum([
  'trialing', 'active', 'grace', 'expired', 'suspended', 'cancelled',
])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>

// ── Subscription row ──────────────────────────────────────────────────────────

export const SubscriptionRowSchema = z.object({
  id:            z.string(),
  company_id:    z.string(),
  plan:          PlanSchema,
  status:        z.string(),
  start_date:    z.string().nullable(),
  end_date:      z.string().nullable(),
  trial_ends_at: z.string().nullable(),
  notes:         z.string().nullable(),
})
export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>

// ── Admin: create company + subscription ─────────────────────────────────────

export const CreateTenantSchema = z.object({
  name: z.string().min(1, 'اسم الشركة مطلوب').max(100),
  plan: PlanSchema.default('free'),
  days: z.number().int().min(1).max(3650).default(30),
})
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>

// ── Admin: update subscription ────────────────────────────────────────────────

export const ExtendSubscriptionSchema = z.object({
  id:   z.string().uuid(),
  days: z.number().int().min(1).max(3650),
})
export type ExtendSubscriptionInput = z.infer<typeof ExtendSubscriptionSchema>

export const UpdateSubscriptionSchema = z.object({
  id:       z.string().uuid(),
  status:   SubscriptionStatusSchema.optional(),
  plan:     PlanSchema.optional(),
  end_date: z.string().optional(),
  notes:    z.string().max(500).optional(),
  days:     z.number().int().min(1).max(3650).optional(),
})
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>

// ── Usage / limits response ───────────────────────────────────────────────────

export const UsageMetricsSchema = z.object({
  products:          z.number(),
  customers:         z.number(),
  salesThisMonth:    z.number(),
  bookingsThisMonth: z.number(),
  activeUsers:       z.number(),
})
export type UsageMetrics = z.infer<typeof UsageMetricsSchema>
