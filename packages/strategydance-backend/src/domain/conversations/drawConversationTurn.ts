import { type ConversationCitation, buildConversationPreview } from 'strategydance-core'
import {
  ConversationToolStatus,
  drawConversationAgentText,
  drawConversationAgentTextPiece,
  drawConversationClientToolCall,
  drawConversationQuestion,
  drawConversationToolCall,
} from 'strategydance-database/backend'

import type { ConversationContentBlock, ConversationRunFence } from '~types'

import { dataConnect } from '~firebase'

import type { ConversationQuestion } from '~domain/agent/checkConversationQuestion'
import type { ConversationToolCallPlan } from '~domain/agent/planConversationToolCalls'
import { toFailedOutput } from '~domain/conversations/conversationToolResults'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import mergeConversationText, {
  type ConversationTextBlockWithCitations,
} from '~domain/conversations/mergeConversationText'
import readPieceText from '~domain/conversations/readPieceText'
import selectPieceCitations from '~domain/conversations/selectPieceCitations'
import splitConversationText from '~domain/conversations/splitConversationText'

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
  - nothing for thinking, Claude's own code execution and its results, and whatever else is not
    text or a web search, so a part ending on those is wholly drawn once its last text is

  Each message's id derives from its part, its first block and its piece, so a worker taking over
  after a crash, which draws from the same cursor, derives the same one
*/
async function drawConversationTurn({ fence, lease, entries, plans, position }: DrawConversationTurnInput) {
  for (const [index, entry] of entries.entries()) {
    const drawing = findNextDrawing(entry, entries.slice(index + 1), plans)

    if (drawing.kind === 'none') continue
    if (drawing.kind === 'waiting') return 'waiting'

    await lease.write(() => write(fence, entry.id, position, drawing))

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
    const { text, pieces, citations, toBlock } = readText(blocks, cursor)
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

    if (isTextBlock(block)) {
      const { text, pieces, citations, toBlock } = readText(blocks, index)
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
  The text run starting at `fromBlock`, merged, with its pieces and its citations. A fallback model
  carries on the text a declining model left, so the run goes on across a `fallback` block between
  two texts, as one reply
*/
function readText(blocks: ConversationContentBlock[], fromBlock: number) {
  let toBlock = fromBlock

  while (isTextBlock(blocks[toBlock]) || blocks[toBlock]?.type === 'fallback') toBlock++
  while (toBlock > fromBlock && !isTextBlock(blocks[toBlock - 1])) toBlock--

  const { text, blockEnds, citations } = mergeConversationText(
    blocks.slice(fromBlock, toBlock).filter(isTextBlock) as ConversationTextBlockWithCitations[],
  )

  return { text, pieces: splitConversationText(text, blockEnds), citations, toBlock }
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

async function write(fence: ConversationRunFence, entryId: string, position: number, drawing: Drawing) {
  if (drawing.kind === 'text') {
    await drawConversationAgentText(dataConnect, {
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
      preview: buildConversationPreview({
        kind: 'TOOL_CALL',
        toolName: drawing.toolName,
        toolStatus: drawing.toolStatus,
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
      preview: buildConversationPreview({
        kind: 'TOOL_CALL',
        toolName: drawing.toolName,
        toolStatus: ConversationToolStatus.RUNNING,
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

function isTextBlock(block: ConversationContentBlock | undefined) {
  return block?.type === 'text' && typeof block.text === 'string'
}

function isWebSearch(block: ConversationContentBlock | undefined): block is ConversationContentBlock & { id: string } {
  return block?.type === 'server_tool_use' && block.name === 'web_search' && typeof block.id === 'string'
}

function isToolCall(block: ConversationContentBlock | undefined): block is ConversationContentBlock & { id: string } {
  return block?.type === 'tool_use' && typeof block.id === 'string'
}

export default drawConversationTurn
