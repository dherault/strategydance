import type { KnowledgeEntry } from '~types'

export type KnowledgeRow = ReturnType<typeof toKnowledgeRow>

/*
  An item as a list shows it, short enough for a kind to fit a page or a few: what tells the agent
  which items to read whole, each value as the package writes it, its meaning left to the read, and
  whether the organization uses it
*/
function toKnowledgeRow({ kind, item }: KnowledgeEntry, inUse: boolean) {
  const { id, name, description } = item

  switch (kind) {
    case 'STRATEGIC_FRAMEWORK':
      return { id, name, description, inUse }
    case 'MARKETING_TACTIC':
      return {
        id,
        name,
        description,
        inUse,
        channel: item.channel,
        effort: item.effort,
        paid: item.paid,
        timeToResults: item.timeToResults,
        technical: item.technical,
      }
    case 'DIRECTORY':
      return {
        id,
        name,
        description,
        inUse,
        type: item.type,
        categories: item.categories,
        businessModel: item.businessModel,
      }
  }
}

export default toKnowledgeRow
