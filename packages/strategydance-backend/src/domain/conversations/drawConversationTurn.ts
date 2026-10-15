import { type ConversationCitation, buildConversationPreview } from 'strategydance-core'
import {
  ConversationApprovalState,
  ConversationToolStatus,
  drawConversationAgentText,
  drawConversationAgentTextPiece,
  drawConversationApproval,
  drawConversationClientToolCall,
  drawConversationQuestion,
  drawConversationToolCall,
  drawSubagentAgentText,
} from 'strategydance-database/backend'

import type { ConversationContentBlock, ConversationRunFence } from '~types'

import { MAX_INTEGRATION_ARGUMENTS_PREVIEW_LENGTH } from '~constants'

import { dataConnect } from '~firebase'

import type { ConversationIntegrationCall } from '~domain/agent/checkConversationIntegrationCall'
import type { ConversationQuestion } from '~domain/agent/checkConversationQuestion'
import decideConversationIntegrationCall, {
  type DrawnIntegration,
  type DrawnIntegrationBinding,
} from '~domain/agent/decideConversationIntegrationCall'
import type { ConversationToolCallPlan } from '~domain/agent/planConversationToolCalls'
import { toFailedOutput } from '~domain/conversations/conversationToolResults'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import readConversationText, { isConversationTextBlock } from '~domain/conversations/readConversationText'
import readPieceText from '~domain/conversations/readPieceText'
import selectPieceCitations from '~domain/conversations/selectPieceCitations'
import readConversationIntegration from '~domain/integrations/readConversationIntegration'

// One part of the run's reply, stored as a transcript entry, with its blocks and its cursor
export type ConversationDrawEntry = {
  id: string
  blocks: ConversationContentBlock[]
  drawnBlocks: number
  drawnPieces: number
}

type DrawConversationTurnInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  // The run's parts, in order
  entries: ConversationDrawEntry[]
  // What becomes of each call to Strategy Dance's own tools in them, by its id
  plans: Map<string, ConversationToolCallPlan>
  // The conversation's counter, where the message goes
  position: number
  // Whether the conversation is a subagent, whose replies nobody reads as they come, so none adds to
  // its unread count
  isSubagent: boolean
}

// What a part draws next from its cursor
type Drawing =
  | { kind: 'none' }
  // A web search whose result a paused part's continuation has not brought yet
  | { kind: 'waiting' }
  | {
      kind: 'text'
      fromBlock: number
      toBlock: number
      // 1 when the text goes on in later pieces
      toPiece?: number
      messageId: string
      text: string
      citations: ConversationCitation[]
    }
  | {
      kind: 'piece'
      block: number
      fromPiece: number
      toBlock: number
      toPiece: number
      messageId: string
      text: string
      citations: ConversationCitation[]
    }
  | {
      kind: 'call'
      fromBlock: number
      toBlock: number
      messageId: string
      toolUseId: string
      toolName: string
      toolStatus: ConversationToolStatus
      toolInput: string
      toolOutput: string
      // A call to an integration refused, with the server and the tool it named
      integration?: DrawnIntegration
    }
  // A call to one of Strategy Dance's own tools, to run
  | {
      kind: 'clientCall'
      fromBlock: number
      toBlock: number
      messageId: string
      toolUseId: string
      toolName: string
      toolInput: string
      // A call to an integration's tool that runs without approval, and what that was bound to
      integration?: DrawnIntegration & { binding: DrawnIntegrationBinding }
    }
  // A call to an integration's tool, before the server is read to say what it becomes
  | {
      kind: 'integrationCall'
      fromBlock: number
      toBlock: number
      messageId: string
      toolUseId: string
      toolName: string
      toolInput: string
      integrationCall: ConversationIntegrationCall
    }
  // A call to an integration's tool that waits for the member's approval
  | {
      kind: 'approval'
      fromBlock: number
      toBlock: number
      messageId: string
      toolUseId: string
      toolName: string
      toolInput: string
      integration: DrawnIntegration & { binding: DrawnIntegrationBinding }
      argumentsPreview: string
    }
  | {
      kind: 'question'
      fromBlock: number
      toBlock: number
      messageId: string
      toolUseId: string
      question: ConversationQuestion
    }

/*
  Draws the next message of the run's reply, from the first of its parts not wholly drawn, and
  answers `drawn`, `waiting` when that next message is a web search whose result has not come yet,
  or `done` once every part is drawn.

  From a part's cursor on, what it draws next is:

  - its consecutive text blocks as one reply, a fallback's boundary between two of them included,
    with the spans web search cited, the blocks before them that draw nothing passed over in the
    same move. A text past 20000 characters is drawn in
    pieces, one at a time, the cursor's piece saying which comes next
  - a web search, as a finished call whose output lists the results' titles and addresses. Its
    result comes in the same part, or opens the next when `pause_turn` paused the turn between
  - a call to one of Strategy Dance's own tools as its plan says: a question the member answers, a
    call that runs, or a call refused, failed with why. A question past its bounds draws nothing
  - a call to an integration's tool as the server read then says: a call that runs, an approval the
    member answers, or a call refused, failed with why
  - nothing for thinking, Claude's own code execution and its results, and whatever else is not
    text or a web search, so a part ending on those is wholly drawn once its last text is

  Each message's id derives from its part, its first block and its piece, so a worker taking over
  after a crash, which draws from the same cursor, derives the same one
*/
async function drawConversationTurn({ fence, lease, entries, plans, position, isSubagent }: DrawConversationTurnInput) {
  for (const [index, entry] of entries.entries()) {
    const drawing = findNextDrawing(entry, entries.slice(index + 1), plans)

    if (drawing.kind === 'none') continue
    if (drawing.kind === 'waiting') return 'waiting'

    const decided = drawing.kind === 'integrationCall' ? await decideIntegrationDrawing(fence, drawing) : drawing

    await lease.write(() => write(fence, entry.id, position, decided, isSubagent))

    return 'drawn'
  }

  return 'done'
}

function findNextDrawing(
  entry: ConversationDrawEntry,
  laterEntries: ConversationDrawEntry[],
  plans: Map<string, ConversationToolCallPlan>,
): Drawing {
  const { blocks, drawnBlocks: cursor, drawnPieces } = entry

  if (drawnPieces > 0) {
    const { text, pieces, citations, toBlock } = readConversationText(blocks, cursor)
    const piece = pieces[drawnPieces]

    if (!piece) throw new Error(`Part ${entry.id} has no piece ${drawnPieces} at block ${cursor}`)

    const isLast = drawnPieces === pieces.length - 1

    return {
      kind: 'piece',
      block: cursor,
      fromPiece: drawnPieces,
      toBlock: isLast ? toBlock : cursor,
      toPiece: isLast ? 0 : drawnPieces + 1,
      messageId: deriveConversationMessageId(entry.id, cursor, drawnPieces),
      text: readPieceText(text, piece),
      citations: selectPieceCitations(citations, piece),
    }
  }

  for (let index = cursor; index < blocks.length; index++) {
    const block = blocks[index]

    if (isConversationTextBlock(block)) {
      const { text, pieces, citations, toBlock } = readConversationText(blocks, index)
      const [first] = pieces

      if (!first) return { kind: 'none' }

      return {
        kind: 'text',
        fromBlock: cursor,
        toBlock: pieces.length > 1 ? index : toBlock,
        ...(pieces.length > 1 ? { toPiece: 1 } : {}),
        messageId: deriveConversationMessageId(entry.id, index, 0),
        text: readPieceText(text, first),
        citations: selectPieceCitations(citations, first),
      }
    }

    if (isWebSearch(block)) {
      const result = findResult(block.id, [{ ...entry, blocks: blocks.slice(index + 1) }, ...laterEntries])

      if (!result) return { kind: 'waiting' }

      return {
        kind: 'call',
        fromBlock: cursor,
        toBlock: index + 1,
        messageId: deriveConversationMessageId(entry.id, index, 0),
        toolUseId: block.id,
        toolName: 'web_search',
        ...describeResult(result),
        toolInput: JSON.stringify(block.input ?? {}),
      }
    }

    const plan = isToolCall(block) ? plans.get(block.id) : undefined

    if (plan && (plan.kind !== 'refused' || plan.isDrawn)) {
      return drawCall(plan, {
        fromBlock: cursor,
        toBlock: index + 1,
        messageId: deriveConversationMessageId(entry.id, index, 0),
      })
    }
  }

  return { kind: 'none' }
}

// A call to one of Strategy Dance's own tools, as its plan draws it
function drawCall(
  plan: ConversationToolCallPlan,
  move: { fromBlock: number; toBlock: number; messageId: string },
): Drawing {
  const { call } = plan

  if (plan.kind === 'question') return { kind: 'question', ...move, toolUseId: call.id, question: plan.question }

  const toolInput = JSON.stringify(call.input ?? {})

  if (plan.kind === 'run') return { kind: 'clientCall', ...move, toolUseId: call.id, toolName: call.name, toolInput }

  if (plan.kind === 'integration') {
    return {
      kind: 'integrationCall',
      ...move,
      toolUseId: call.id,
      toolName: call.name,
      toolInput,
      integrationCall: plan.integrationCall,
    }
  }

  return {
    kind: 'call',
    ...move,
    toolUseId: call.id,
    toolName: call.name,
    toolStatus: ConversationToolStatus.FAILED,
    toolInput,
    toolOutput: toFailedOutput(plan.reason),
  }
}

/*
  What a call to an integration's tool is drawn as, from the server as the run's member reads it now:
  decided once, since the message drawn keeps it for a worker taking over
*/
async function decideIntegrationDrawing(
  fence: ConversationRunFence,
  drawing: Extract<Drawing, { kind: 'integrationCall' }>,
): Promise<Drawing> {
  const { integrationCall, ...move } = drawing
  const read = await readConversationIntegration(fence, integrationCall.integrationId)
  const decided = decideConversationIntegrationCall(read, integrationCall)

  switch (decided.kind) {
    case 'refused':
      return {
        ...move,
        kind: 'call',
        toolStatus: ConversationToolStatus.FAILED,
        toolOutput: toFailedOutput(decided.reason),
        ...(decided.integration && { integration: decided.integration }),
      }
    case 'run':
      return { ...move, kind: 'clientCall', integration: { ...decided.integration, binding: decided.binding } }
    case 'approval':
      return {
        ...move,
        kind: 'approval',
        integration: { ...decided.integration, binding: decided.binding },
        argumentsPreview: toArgumentsPreview(integrationCall.arguments),
      }
  }
}

/*
  A call's arguments as its approval shows them at a glance: their JSON, which escapes U+0000, cut at
  a grapheme's boundary, with an ellipsis when cut. It authorizes nothing: Allow shows them whole
*/
function toArgumentsPreview(args: Record<string, unknown>) {
  const json = JSON.stringify(args)

  if (json.length <= MAX_INTEGRATION_ARGUMENTS_PREVIEW_LENGTH) return json

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  let cut = ''

  for (const { segment } of segmenter.segment(json)) {
    if (cut.length + segment.length > MAX_INTEGRATION_ARGUMENTS_PREVIEW_LENGTH) break

    cut += segment
  }

  return `${cut}…`
}

// A web search's result, `content` a list of results or an error object
function findResult(toolUseId: string, entries: Pick<ConversationDrawEntry, 'blocks'>[]) {
  for (const { blocks } of entries) {
    const result = blocks.find(block => block.type === 'web_search_tool_result' && block.tool_use_id === toolUseId)

    if (result) return result
  }

  return null
}

function describeResult(result: ConversationContentBlock) {
  if (!Array.isArray(result.content)) {
    const error = result.content as { error_code?: unknown } | null

    return {
      toolStatus: ConversationToolStatus.FAILED,
      toolOutput: JSON.stringify({ error: typeof error?.error_code === 'string' ? error.error_code : 'unavailable' }),
    }
  }

  const results = (result.content as unknown[]).flatMap(item => {
    const { type, title, url } = (item ?? {}) as Record<string, unknown>

    return type === 'web_search_result' && typeof url === 'string'
      ? [{ title: typeof title === 'string' ? title : null, url }]
      : []
  })

  return { toolStatus: ConversationToolStatus.SUCCEEDED, toolOutput: JSON.stringify({ results }) }
}

async function write(
  fence: ConversationRunFence,
  entryId: string,
  position: number,
  drawing: Drawing,
  isSubagent: boolean,
) {
  if (drawing.kind === 'text') {
    const drawText = isSubagent ? drawSubagentAgentText : drawConversationAgentText

    await drawText(dataConnect, {
      ...fence,
      entryId,
      fromBlock: drawing.fromBlock,
      toBlock: drawing.toBlock,
      ...(drawing.toPiece === undefined ? {} : { toPiece: drawing.toPiece }),
      messageId: drawing.messageId,
      position,
      text: drawing.text,
      ...(drawing.citations.length ? { citations: drawing.citations } : {}),
      preview: buildConversationPreview({ kind: 'AGENT_TEXT', text: drawing.text }),
    })
  }

  if (drawing.kind === 'piece') {
    await drawConversationAgentTextPiece(dataConnect, {
      ...fence,
      entryId,
      block: drawing.block,
      fromPiece: drawing.fromPiece,
      toBlock: drawing.toBlock,
      toPiece: drawing.toPiece,
      messageId: drawing.messageId,
      position,
      text: drawing.text,
      ...(drawing.citations.length ? { citations: drawing.citations } : {}),
      preview: buildConversationPreview({ kind: 'AGENT_TEXT', text: drawing.text }),
    })
  }

  if (drawing.kind === 'call') {
    await drawConversationToolCall(dataConnect, {
      ...fence,
      entryId,
      fromBlock: drawing.fromBlock,
      toBlock: drawing.toBlock,
      messageId: drawing.messageId,
      position,
      toolUseId: drawing.toolUseId,
      toolName: drawing.toolName,
      toolStatus: drawing.toolStatus,
      toolInput: drawing.toolInput,
      toolOutput: drawing.toolOutput,
      ...(drawing.integration && {
        integrationId: drawing.integration.id,
        integrationName: drawing.integration.name,
        integrationToolName: drawing.integration.toolName,
      }),
      preview: buildConversationPreview({
        kind: 'TOOL_CALL',
        toolName: drawing.toolName,
        toolStatus: drawing.toolStatus,
        integrationName: drawing.integration?.name,
      }),
    })
  }

  if (drawing.kind === 'clientCall') {
    await drawConversationClientToolCall(dataConnect, {
      ...fence,
      entryId,
      fromBlock: drawing.fromBlock,
      toBlock: drawing.toBlock,
      messageId: drawing.messageId,
      position,
      toolUseId: drawing.toolUseId,
      toolName: drawing.toolName,
      toolInput: drawing.toolInput,
      ...(drawing.integration && {
        integrationId: drawing.integration.id,
        integrationName: drawing.integration.name,
        integrationToolName: drawing.integration.toolName,
        approvalConfigRevision: drawing.integration.binding.configRevision,
        approvalToolHash: drawing.integration.binding.toolHash,
        approvalCredentialGeneration: drawing.integration.binding.credentialGeneration,
      }),
      preview: buildConversationPreview({
        kind: 'TOOL_CALL',
        toolName: drawing.toolName,
        toolStatus: ConversationToolStatus.RUNNING,
        integrationName: drawing.integration?.name,
      }),
    })
  }

  if (drawing.kind === 'approval') {
    await drawConversationApproval(dataConnect, {
      ...fence,
      entryId,
      fromBlock: drawing.fromBlock,
      toBlock: drawing.toBlock,
      messageId: drawing.messageId,
      position,
      toolUseId: drawing.toolUseId,
      toolName: drawing.toolName,
      toolInput: drawing.toolInput,
      integrationId: drawing.integration.id,
      integrationName: drawing.integration.name,
      integrationToolName: drawing.integration.toolName,
      approvalConfigRevision: drawing.integration.binding.configRevision,
      approvalToolHash: drawing.integration.binding.toolHash,
      approvalCredentialGeneration: drawing.integration.binding.credentialGeneration,
      argumentsPreview: drawing.argumentsPreview,
      preview: buildConversationPreview({
        kind: 'APPROVAL',
        integrationName: drawing.integration.name,
        integrationToolName: drawing.integration.toolName,
        approvalState: ConversationApprovalState.PENDING,
      }),
    })
  }

  if (drawing.kind === 'question') {
    await drawConversationQuestion(dataConnect, {
      ...fence,
      entryId,
      fromBlock: drawing.fromBlock,
      toBlock: drawing.toBlock,
      messageId: drawing.messageId,
      position,
      toolUseId: drawing.toolUseId,
      questionPrompt: drawing.question.prompt,
      questionOptions: drawing.question.options,
      isMultipleChoice: drawing.question.isMultipleChoice,
      preview: buildConversationPreview({ kind: 'QUESTION', questionPrompt: drawing.question.prompt }),
    })
  }
}

function isWebSearch(block: ConversationContentBlock | undefined): block is ConversationContentBlock & { id: string } {
  return block?.type === 'server_tool_use' && block.name === 'web_search' && typeof block.id === 'string'
}

function isToolCall(block: ConversationContentBlock | undefined): block is ConversationContentBlock & { id: string } {
  return block?.type === 'tool_use' && typeof block.id === 'string'
}

export default drawConversationTurn
