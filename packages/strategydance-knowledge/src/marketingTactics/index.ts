import marketingTactics from './marketingTactics.json'
import type { MarketingTactic } from './types'

export * from './constants'
export * from './enums'

export type * from './types'

/*
  Read on 2026-10-30 from the first Strategy Dance's list, then rewritten: overlapping tactics
  merged, each given a channel, a time to results and the metrics that tell whether it works
*/
export const MARKETING_TACTICS = marketingTactics as MarketingTactic[]
