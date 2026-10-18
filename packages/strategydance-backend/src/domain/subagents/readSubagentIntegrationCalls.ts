import { getSubagentIntegrationCallsForAgent } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import toSubagentIntegrationCall, { type SubagentIntegrationCall } from '~domain/subagents/toSubagentIntegrationCall'

type Member = { organizationId: string; userId: string; membershipCreatedAt: string }

/*
  The calls a subagent made to the organization's integrations, oldest first, each with its server,
  its tool and how it ended, and how many it made: those that started, since a call refused as it was
  drawn reached no server. A call to another company's server is what no restore undoes and nothing
  in the team's knowledge or board shows, so its parent hears of each. Null once the membership is
  gone. The caller reads the subagent first, as its own and its parent's
*/
async function readSubagentIntegrationCalls(
  { organizationId, userId, membershipCreatedAt }: Member,
  subagentId: string,
): Promise<{ calls: SubagentIntegrationCall[]; total: number } | null> {
  const { data } = await getSubagentIntegrationCallsForAgent(dataConnect, {
    organizationId,
    userId,
    membershipCreatedAt,
    subagentId: toCanonicalUuid(subagentId),
  })

  if (data.membership.length === 0) return null

  return { calls: data.calls.map(toSubagentIntegrationCall), total: data.total[0]?._count ?? 0 }
}

export default readSubagentIntegrationCalls
