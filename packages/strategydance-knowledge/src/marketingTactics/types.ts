import type { MarketingTacticChannel, MarketingTacticEffort, MarketingTacticTimeToResults } from './enums'

// A way to market a product, with what it takes and what to watch to tell whether it works
export type MarketingTactic = {
  // A slug of the name the tactic was first given, which never changes, even when the name does, so
  // whatever refers to it keeps finding it
  id: string
  name: string
  // What the tactic is, in one sentence
  description: string
  // How to run it, in a few sentences a founder can follow
  howTo: string
  channel: MarketingTacticChannel
  effort: MarketingTacticEffort
  // Whether it costs money beyond time: ads, sponsorships, rewards or prizes
  paid: boolean
  timeToResults: MarketingTacticTimeToResults
  // Whether it takes building something: a page, a tool, code or an integration
  technical: boolean
  // What to measure to tell whether it works, each something a run can set a target for and read
  // back
  metrics: string[]
}
