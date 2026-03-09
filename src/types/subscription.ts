/** Mirrors the Firestore `userSubscriptions/{userId}` document */
export interface UserSubscription {
  status: string       // 'active' | 'canceled' | 'past_due' | 'trialing' | ...
  planType: string     // 'basic(free)' | 'professional' | 'advanced' | 'footwearology'
  currentPeriodEnd: unknown  // Firestore Timestamp — not used directly in FootwearMaker
}

/** Plan types that qualify for Pro access in FootwearMaker */
export const PRO_PLAN_TYPES = ['professional', 'advanced', 'footwearology'] as const
export type ProPlanType = (typeof PRO_PLAN_TYPES)[number]

/**
 * Link shown in the ProFeatureModal "Upgrade Plan" button.
 * Update this to `https://www.pixolid.de/subscription` once that page is live.
 */
export const UPGRADE_URL = 'https://www.pixolid.de'
