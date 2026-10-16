import {
  type CompanyAspect,
  ConversationTranscriptRole,
  getConversationRequestContext,
} from 'strategydance-database/backend'

import type { ConversationModules, ConversationRunFence } from '~types'

import { dataConnect } from '~firebase'

import buildConversationContext from '~domain/agent/buildConversationContext'
import buildConversationTools from '~domain/agent/buildConversationTools'
import connectConversationModules from '~domain/agent/connectConversationModules'
import conversationClaudeClient from '~domain/agent/conversationClaudeClient'
import measureConversationSend from '~domain/agent/measureConversationSend'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import toConversationProfile from '~domain/agent/toConversationProfile'
import { parseConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import type { ConversationSendAttachment } from '~domain/conversations/readConversationSendAttachments'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'

type ModulesCaller = Pick<ConversationRunFence, 'organizationId' | 'userId' | 'conversationId' | 'membershipCreatedAt'>

type MeasureConversationMessageInput = ModulesCaller & {
  // The aspects a message that starts its conversation starts it with, which its context names
  aspects?: CompanyAspect[]
  // The entry the message is stored as, as JSON text
  content: string
  // The files it sends
  attachments: ConversationSendAttachment[]
  // How the tools are listed, which the tests replace
  connectModules?: (caller: ModulesCaller) => Promise<ConversationModules>
}

/*
  How many input tokens the first request of the run a message with files starts will take, read as
  that run will build it: the transcript, the context message it will send, with the profile as it
  stands, the tools it will send, the modules' listed as the run lists them, and every file's count,
  the conversation's and the message's own. Only a message with files is measured, since files are
  what can fill a conversation at once
*/
async function measureConversationMessage({
  aspects,
  content,
  attachments,
  connectModules = connectConversationModules,
  ...caller
}: MeasureConversationMessageInput) {
  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    conversationId: caller.conversationId,
  }
  const [entries, { data }] = await Promise.all([
    readConversationTranscript(reference),
    getConversationRequestContext(dataConnect, reference),
  ])
  const profile = toConversationProfile(data)
  const context = buildConversationContext({
    profile: data.conversations.length ? profile : { ...profile, aspects: aspects ?? [] },
    now: new Date(),
    lastContextHash: entries.findLast(({ role }) => role === ConversationTranscriptRole.SYSTEM)?.contextHash ?? null,
  })
  const fileTokens = new Map<string, number>()

  for (const { claudeFileId, tokenCount } of data.conversationAttachments) {
    if (claudeFileId && typeof tokenCount === 'number') fileTokens.set(claudeFileId, tokenCount)
  }

  for (const { claudeFileId, tokenCount } of attachments) fileTokens.set(claudeFileId, tokenCount)

  const modules = await connectModules(caller)

  try {
    return await measureConversationSend({
      client: conversationClaudeClient,
      config: { system: CONVERSATION_SYSTEM_PROMPT, tools: buildConversationTools(modules.tools) },
      entries,
      entry: parseTranscriptContent(content),
      context: context.content,
      runs: data.conversationRuns.map(run => ({ id: run.id, usage: parseConversationRunUsage(run.usage) })),
      fileTokens,
    })
  } finally {
    await modules.close()
  }
}

export default measureConversationMessage
