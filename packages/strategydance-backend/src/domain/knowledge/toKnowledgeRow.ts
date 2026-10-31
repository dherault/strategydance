import type { KnowledgeEntry } from '~types'

export type KnowledgeRow = ReturnType<typeof toKnowledgeRow>

/*
  An item as a list shows it, short enough for a kind to fit a page or a few: what tells the agent
  which items to read whole, each value as the package writes it, its meaning left to the read
*/
function toKnowledgeRow({ kind, item }: KnowledgeEntry) {
  const { id, name, description } = item

  switch (kind) {
    case 'STRATEGIC_FRAMEWORK':
      return { id, name, description }
    case 'MARKETING_TACTIC':
      return {
        id,
        name,
        description,
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
        type: item.type,
        categories: item.categories,
        businessModel: item.businessModel,
      }
  }
}

export default toKnowledgeRow
