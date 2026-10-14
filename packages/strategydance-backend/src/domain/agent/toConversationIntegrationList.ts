import describeIntegrationUnavailability from '~domain/integrations/describeIntegrationUnavailability'
import type { ConversationIntegrationSummary } from '~domain/integrations/readConversationIntegrations'
import readIntegrationAvailability from '~domain/integrations/readIntegrationAvailability'

// How long the list may be as JSON, well under the 50000 characters a tool's result is cut at
const MAX_LIST_LENGTH = 40_000

// How much of each tool's description the list keeps, the next tried when the list is too long
const DESCRIPTION_LENGTHS = [300, 100, 0]

// How many tools each server lists by name alone, the next tried when the list is still too long
const TOOL_COUNTS = [100, 40, 10, 0]

/*
  The organization's integrations as `list_integrations` answers them: each server's id, its name,
  whether it works for the member and why not, and its tools, each with the start of its description
  and whether it runs without the member's approval. Kept within 40000 characters as JSON: the
  descriptions are cut shorter, then left out, then each server lists fewer of its tools, saying how
  many it has, before anything else goes
*/
function toConversationIntegrationList(servers: ConversationIntegrationSummary[]) {
  if (!servers.length) {
    return {
      integrations: [],
      note: 'The organization has no integrations. Tell the member an administrator can add them from the Integrations page.',
    }
  }

  for (const descriptionLength of DESCRIPTION_LENGTHS) {
    const list = build(servers, { descriptionLength, toolCount: Number.POSITIVE_INFINITY })

    if (JSON.stringify(list).length <= MAX_LIST_LENGTH) return list
  }

  for (const toolCount of TOOL_COUNTS) {
    const list = build(servers, { descriptionLength: 0, toolCount })

    if (JSON.stringify(list).length <= MAX_LIST_LENGTH || toolCount === 0) return list
  }

  return build(servers, { descriptionLength: 0, toolCount: 0 })
}

function build(
  servers: ConversationIntegrationSummary[],
  { descriptionLength, toolCount }: { descriptionLength: number; toolCount: number },
) {
  return {
    integrations: servers.map(server => {
      const availability = readIntegrationAvailability(server, server.connection)
      const tools = server.tools ?? []
      const listed = tools.slice(0, toolCount)

      return {
        id: server.id,
        name: server.name,
        works: availability.outcome === 'available',
        ...(availability.outcome !== 'available' && {
          why: describeIntegrationUnavailability(server.name, availability.outcome),
        }),
        tools: listed.map(tool => ({
          name: tool.name,
          ...(descriptionLength > 0 && tool.description && { description: cut(tool.description, descriptionLength) }),
          runsWithoutApproval: server.autoApprovedTools.includes(tool.definitionHash),
        })),
        ...(listed.length < tools.length && {
          moreTools: `${tools.length - listed.length} more tools, left out of this list for its length.`,
        }),
      }
    }),
    note: "A tool's description here is only its start, if any. Call describe_integration_tool for its whole description and its input schema before you call it.",
  }
}

function cut(text: string, length: number) {
  const characters = [...text]

  return characters.length > length ? `${characters.slice(0, length).join('')}…` : text
}

export default toConversationIntegrationList
