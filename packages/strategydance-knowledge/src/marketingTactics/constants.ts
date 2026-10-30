import { MarketingTacticChannel, MarketingTacticEffort, MarketingTacticTimeToResults } from './enums'
import type { MarketingTactic } from './types'

/*
  What each channel means, in the words a person reads here and an agent is given, so the two never
  say different things
*/
export const MARKETING_TACTIC_CHANNEL_DESCRIPTIONS: Record<MarketingTacticChannel, string> = {
  [MarketingTacticChannel.SOCIAL_MEDIA]:
    'Posting and replying on social networks, such as X, LinkedIn, Instagram or TikTok',
  [MarketingTacticChannel.COMMUNITIES]:
    'Taking part in, or running, the places where the audience talks: Reddit, Quora, forums, Slack and Discord groups',
  [MarketingTacticChannel.CONTENT]:
    "Writing or recording what the audience looks for, on your own site or someone else's: articles, videos, podcasts, reports",
  [MarketingTacticChannel.SEO]: 'Pages built to be found by people searching for what you sell',
  [MarketingTacticChannel.EMAIL]: 'Building, and writing to, a list of people who asked to hear from you',
  [MarketingTacticChannel.OUTREACH]:
    'Reaching prospects one by one: cold emails, messages, calls and free consultations',
  [MarketingTacticChannel.ADVERTISING]: 'Paying for reach: ads and sponsored placements',
  [MarketingTacticChannel.PARTNERSHIPS]: 'Working with companies and creators who already reach your audience',
  [MarketingTacticChannel.LAUNCHES]: 'Launch sites, directories and marketplaces that list products',
  [MarketingTacticChannel.EVENTS]: 'Sessions, live or online, such as webinars, AMAs, challenges and summits',
  [MarketingTacticChannel.PROMOTIONS]: 'Offers that draw people in: giveaways, discounts and early access',
  [MarketingTacticChannel.PRESS]: 'Journalists, podcasts and the other media that cover your field',
  [MarketingTacticChannel.PRODUCT]:
    'What the product itself does to bring users: free tools, integrations, sharing, a public roadmap',
  [MarketingTacticChannel.REFERRALS]:
    'Rewarding the people who bring you customers: referral, affiliate and ambassador programs',
}

export const MARKETING_TACTIC_EFFORT_DESCRIPTIONS: Record<MarketingTacticEffort, string> = {
  [MarketingTacticEffort.LOW]: 'A few hours, once or now and then',
  [MarketingTacticEffort.MEDIUM]: 'A few hours a week, or a few days to set up',
  [MarketingTacticEffort.HIGH]: 'A steady commitment over months, or weeks of building',
}

export const MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS: Record<MarketingTacticTimeToResults, string> = {
  [MarketingTacticTimeToResults.DAYS]: 'Results show within days',
  [MarketingTacticTimeToResults.WEEKS]: 'Results show within weeks',
  [MarketingTacticTimeToResults.MONTHS]: 'Results build over months, and keep coming once they do',
}

/*
  Each entry's fields, in the order the file holds them. A record rather than a list, so the
  typechecker refuses a field missing from it or one the type lacks
*/
const MARKETING_TACTIC_FIELD_ORDER: Record<keyof MarketingTactic, true> = {
  id: true,
  name: true,
  description: true,
  howTo: true,
  channel: true,
  effort: true,
  paid: true,
  timeToResults: true,
  technical: true,
  metrics: true,
}

export const MARKETING_TACTIC_FIELDS = Object.keys(MARKETING_TACTIC_FIELD_ORDER) as readonly (keyof MarketingTactic)[]
