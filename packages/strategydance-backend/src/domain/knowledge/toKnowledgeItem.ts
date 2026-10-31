import {
  DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS,
  DIRECTORY_CATEGORY_DESCRIPTIONS,
  DIRECTORY_INACTIVE_REASON_DESCRIPTIONS,
  MARKETING_TACTIC_CHANNEL_DESCRIPTIONS,
  MARKETING_TACTIC_EFFORT_DESCRIPTIONS,
  MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS,
} from 'strategydance-knowledge'

import type { KnowledgeEntry } from '~types'

export type KnowledgeItem = ReturnType<typeof toKnowledgeItem>

// A value of one of the package's enums, with what it means in the package's words
function toMeaning<Value extends string>(value: Value, meanings: Record<Value, string>) {
  return { value, meaning: meanings[value] }
}

/*
  An item whole, every field in the order the package writes it, which spreading it keeps, each
  value the package gives a meaning carried with it, so the agent never needs them in a tool's
  description. A directory's type, a website or a Reddit community, has none, and an inactive
  directory keeps its reason last
*/
function toKnowledgeItem({ kind, item }: KnowledgeEntry) {
  switch (kind) {
    case 'STRATEGIC_FRAMEWORK':
      return { ...item }
    case 'MARKETING_TACTIC':
      return {
        ...item,
        channel: toMeaning(item.channel, MARKETING_TACTIC_CHANNEL_DESCRIPTIONS),
        effort: toMeaning(item.effort, MARKETING_TACTIC_EFFORT_DESCRIPTIONS),
        timeToResults: toMeaning(item.timeToResults, MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS),
      }
    case 'DIRECTORY':
      return {
        ...item,
        categories: item.categories.map(category => toMeaning(category, DIRECTORY_CATEGORY_DESCRIPTIONS)),
        businessModel: toMeaning(item.businessModel, DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS),
        ...('inactiveReason' in item && {
          inactiveReason: toMeaning(item.inactiveReason, DIRECTORY_INACTIVE_REASON_DESCRIPTIONS),
        }),
      }
  }
}

export default toKnowledgeItem
