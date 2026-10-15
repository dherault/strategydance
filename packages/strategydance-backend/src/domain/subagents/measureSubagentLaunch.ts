import { getConversationRequestContext } from 'strategydance-database/backend'

import type { ConversationContentBlock } from '~types'

import { dataConnect } from '~firebase'

import buildConversationContext from '~domain/agent/buildConversationContext'
import buildSubagentTools from '~domain/agent/buildSubagentTools'
import connectConversationModules from '~domain/agent/connectConversationModules'
import conversationClaudeClient from '~domain/agent/conversationClaudeClient'
import measureConversationSend from '~domain/agent/measureConversationSend'
import SUBAGENT_SYSTEM_PROMPT from '~domain/agent/subagentSystemPrompt'
import toConversationProfile from '~domain/agent/toConversationProfile'

type MeasureSubagentLaunchInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  parentId: string
  subagentId: string
  membershipCreatedAt: string
  // The brief's entry, its files before its text
  content: ConversationContentBlock[]
  // The files it hands over, each with what its upload counted
  files: { claudeFileId: string; tokenCount: number }[]
}

/*
  How many input tokens a subagent's first request will take, measured whole before it is launched,
  as its run will build it: the subagent's system prompt and tools, the modules' listed as its worker
  lists them, its brief, and the context message its run will send, the one its parent's next run
  would, with the whole profile, since no context is in its transcript yet. Each file counts what its
  upload counted, since the count endpoint takes no Files API source. Only a launch with files is
  measured: a brief alone never comes near a send's budget
*/
async function measureSubagentLaunch({
  organizationId,
  userId,
  parentId,
  subagentId,
  membershipCreatedAt,
  content,
  files,
}: MeasureSubagentLaunchInput) {
  const { data } = await getConversationRequestContext(dataConnect, {
    organizationId,
    userId,
    conversationId: parentId,
  })
  const context = buildConversationContext({
    profile: toConversationProfile(data),
    now: new Date(),
    lastContextHash: null,
  })
  const modules = await connectConversationModules({
    organizationId,
    userId,
    conversationId: subagentId,
    membershipCreatedAt,
  })

  try {
    return await measureConversationSend({
      client: conversationClaudeClient,
      config: { system: SUBAGENT_SYSTEM_PROMPT, tools: buildSubagentTools(modules.tools) },
      entries: [],
      entry: content,
      context: context.content,
      runs: [],
      fileTokens: new Map(files.map(({ claudeFileId, tokenCount }) => [claudeFileId, tokenCount])),
    })
  } finally {
    await modules.close()
  }
}

export default measureSubagentLaunch
