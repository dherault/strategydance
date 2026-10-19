import Anthropic, { toFile } from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  BetaMessageStreamParams,
  BetaServerToolUseBlock,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

import { SECRET_ANTHROPIC_API_KEY, WEB_SEARCH_RESULT_TOKEN_ALLOWANCE } from '~constants'

import retrieveSecret from '~utils/retrieveSecret'

import buildConversationRequest from '~domain/agent/buildConversationRequest'
import buildConversationTaggingRequest from '~domain/agent/buildConversationTaggingRequest'
import buildConversationTools, { type ConversationRequestTools } from '~domain/agent/buildConversationTools'
import buildSubagentTools from '~domain/agent/buildSubagentTools'
import connectConversationModules from '~domain/agent/connectConversationModules'
import {
  CLAUDE_FALLBACK_MODELS,
  CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND,
  CLAUDE_MODEL_PRICES,
  CONVERSATION_MODEL,
  WEB_SEARCH_PRICE_MICRODOLLARS,
} from '~domain/agent/conversationRequestSettings'
import readConversationTagging from '~domain/agent/readConversationTagging'
import readSubagentRequestSettings from '~domain/agent/subagentRequestSettings'
import SUBAGENT_SYSTEM_PROMPT from '~domain/agent/subagentSystemPrompt'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import { priceAttemptWorstCase } from '~domain/conversations/priceConversationUsage'

/*
  Checks, against Claude's API itself, the facts the conversations agent is built on, which no test
  without the real model can confirm:

    bun run probe:claude

  It sends the request the agent will send (conversations.md, The agent), streamed: adaptive
  thinking with progress updates and `drop_block`, explicit effort, server-side refusal fallbacks,
  a strict tool with eager input streaming, web search, top-level caching and the context message
  last, and reports the progress lines it gets, which the API does not promise. Then it replays
  that turn from its JSON text, as the transcript stores it, and again with the tool's input
  reordered as Postgres `jsonb` would reorder it; counts the tokens of a PDF and an image from their
  bytes, uploads them through the Files API and has a message read them by id, as the upload route
  and the agent will; sends the agent's own request, its system prompt and every tool it sends, the
  modules' included, as a run builds it, which the API refuses whole when a tool's schema is one it
  does not take, twice, the second reading what the first cached, counts what the modules' tools
  add to every request, and has Claude call a module's tool and the integration call tool, neither
  strict, the second with its arguments as an object; sends the
  request that tags a conversation with its aspects, its answer held to a schema, and reads it as the
  worker does; and sends the first request and the replay straight to each model
  a refusal may fall back to, which the cost limit's price table has to list. For the cost limit
  besides: sends the replay again without `fallbacks`, which has to read the cache all the same, and
  has Claude search the web a few times over, to measure what a search brings back past a reading
  of the request's input, which `WEB_SEARCH_RESULT_TOKEN_ALLOWANCE` has to hold, and once five times,
  step by step through its iterations, each result's first reading held to the allowance and all
  it billed as input to what the worst case reserves for five searches, earlier results and outputs
  read again included. Every stream it sends is timed, and each model's fastest writing, output
  tokens a second from its start to its end, held to half its `CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND`,
  which bounds what a stream cut partway counts at. It prints what passed, what failed and what it
  found, and exits non-zero naming every check that did not pass.

  It calls the real model, so it costs money, a dollar or two a run: run it after an Anthropic SDK
  bump or a change of model, never in CI. It reads the API key from Secret Manager with Application
  Default Credentials, or from ANTHROPIC_API_KEY when that is set, for a machine whose credentials
  cannot read the secret:

    ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret=anthropic-api-key --project=strategydance) bun run probe:claude
*/

const MODEL = 'claude-opus-5-5'

// How many times a turn paused by web search's server-side loop is sent back, as the agent will
const MAX_PAUSES = 5

const SYSTEM_PROMPT = `You are Strategy Dance, a companion for solo entrepreneurs, here in a test of the request that
carries every conversation. Answer briefly and plainly. When asked to look something up, search
the web once, then do what the member asked with the result. When asked to record a decision, call
record_decision exactly once, with a short title, the aspects of the company it touches, and a
short id in lowercase words joined by hyphens.`

const CONTEXT_MESSAGE =
  'Context: today is Sunday 4 October 2026, 11:00 in Europe/Paris. The member is David, founder of Strategy Dance. They write in English.'

const FIRST_MESSAGE =
  "Search the web for the monthly price per member of Notion's Plus plan, then record the decision to price Strategy Dance below it."

const TOOLS: BetaMessageStreamParams['tools'] = [
  {
    name: 'record_decision',
    description: 'Records a decision the member took, with the aspects of the company it touches.',
    strict: true,
    eager_input_streaming: true,
    // Declared out of alphabetical order, and in another order than `jsonb`'s, shorter keys first
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The decision, in a few words' },
        aspects: { type: 'array', items: { type: 'string' }, description: 'Such as STRATEGY, PRODUCT or FINANCE' },
        id: { type: 'string', description: 'A short id in lowercase words joined by hyphens' },
      },
      required: ['title', 'aspects', 'id'],
      additionalProperties: false,
    },
  },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
]

const FIRST_MESSAGES: BetaMessageParam[] = [
  { role: 'user', content: FIRST_MESSAGE },
  { role: 'system', content: CONTEXT_MESSAGE },
]

type Result = { name: string; outcome: 'pass' | 'fail' | 'skip'; detail?: string }

// A turn as it comes back: its pieces, more than one when web search paused it
type Turn = { pieces: BetaMessage[]; inputJsonDeltas: number }

type ThinkingField = 'display' | 'block_binding'

type BodyOptions = {
  model?: string
  // The thinking fields sent beside its type, to find what a fallback model refuses
  thinking?: readonly ThinkingField[]
}

const results: Result[] = []

const findings: [string, unknown][] = []

const startedAt = Date.now()

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || (await retrieveSecret(SECRET_ANTHROPIC_API_KEY)),
})

// The fastest each model wrote, in output tokens a second, over every stream sent
const outputRates = new Map<string, number>()

/*
  Times every stream the probe sends, from its message's start to its final message, and keeps each
  model's fastest: what a stream cut partway is bounded by in the cost limit and the ceilings
*/
const sendStream = client.beta.messages.stream.bind(client.beta.messages)

client.beta.messages.stream = ((...args: Parameters<typeof sendStream>) => {
  const stream = sendStream(...args)
  let startedAt: number | null = null

  stream.on('streamEvent', event => {
    if (event.type === 'message_start') startedAt ??= Date.now()
  })
  stream.on('finalMessage', message => {
    if (startedAt === null || message.usage.output_tokens < 100) return

    const rate = message.usage.output_tokens / Math.max(0.001, (Date.now() - startedAt) / 1000)

    outputRates.set(message.model, Math.max(outputRates.get(message.model) ?? 0, rate))
  })

  return stream
}) as typeof client.beta.messages.stream

/*
  The agent's request. Only the agent's own model falls back on a refusal: a request sent straight
  to a fallback model, to see whether it takes the same body, goes without
*/
function buildBody(
  messages: BetaMessageParam[],
  { model = MODEL, thinking = ['display', 'block_binding'] }: BodyOptions = {},
): BetaMessageStreamParams {
  const hasFallbacks = model === MODEL

  return {
    model,
    max_tokens: 64000,
    betas: [
      'thinking-display-updates-2026-08-18',
      'thinking-binding-controls-2026-08-01',
      ...(hasFallbacks ? (['server-side-fallback-2026-07-01'] as const) : []),
    ],
    thinking: {
      type: 'adaptive',
      ...(thinking.includes('display') ? { display: 'updates' as const } : {}),
      ...(thinking.includes('block_binding')
        ? { block_binding: { prefix_mismatch_behavior: 'drop_block' as const } }
        : {}),
    },
    ...(hasFallbacks ? { fallbacks: 'default' as const } : {}),
    output_config: { effort: 'medium' },
    cache_control: { type: 'ephemeral' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: TOOLS,
    messages,
  }
}

// One turn, streamed, each piece a paused turn sent back as it is, progress lines logged as they land
async function runTurn(messages: BetaMessageParam[], options: BodyOptions = {}) {
  const turn: Turn = { pieces: [], inputJsonDeltas: 0 }
  let sent = messages

  for (;;) {
    const stream = client.beta.messages.stream(buildBody(sent, options))

    stream.on('inputJson', () => turn.inputJsonDeltas++)
    stream.on('contentBlock', block => {
      if (block.type === 'thinking' && block.thinking) log(`progress: ${block.thinking}`)
    })

    const message = await stream.finalMessage()

    turn.pieces.push(message)

    if (message.stop_reason !== 'pause_turn' || turn.pieces.length > MAX_PAUSES) return turn

    sent = [...sent, { role: 'assistant', content: message.content }]
  }
}

async function check(name: string, run: () => unknown) {
  try {
    const detail = await run()

    results.push({ name, outcome: 'pass', detail: typeof detail === 'string' ? detail : undefined })
    log(`✓ ${name}`)
  } catch (error) {
    results.push({ name, outcome: 'fail', detail: describeError(error) })
    log(`✗ ${name}: ${describeError(error)}`)
  }
}

function skip(name: string, reason: string) {
  results.push({ name, outcome: 'skip', detail: reason })
  log(`- ${name}: skipped, ${reason}`)
}

function finding(name: string, value: unknown) {
  findings.push([name, value])
  log(`• ${name}: ${JSON.stringify(value)}`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function describeError(error: unknown) {
  if (error instanceof Anthropic.APIError) return `${error.status ?? 'no status'} ${error.message}`
  if (error instanceof Error) return error.message

  return String(error)
}

function log(line: string) {
  console.log(`[${((Date.now() - startedAt) / 1000).toFixed(1)}s] ${line}`)
}

function readBlocks(turn: Turn) {
  return turn.pieces.flatMap(piece => piece.content)
}

function readDecisions(turn: Turn) {
  return readBlocks(turn).filter(
    (block): block is BetaToolUseBlock => block.type === 'tool_use' && block.name === 'record_decision',
  )
}

function readUsage(turn: Turn) {
  return turn.pieces.map(({ usage }) => ({
    input: usage.input_tokens,
    cacheCreation: usage.cache_creation_input_tokens,
    cacheRead: usage.cache_read_input_tokens,
    output: usage.output_tokens,
    webSearches: usage.server_tool_use?.web_search_requests ?? 0,
  }))
}

function readTransformations(turn: Turn) {
  return turn.pieces.flatMap(piece => piece.input_transformations ?? [])
}

// The turn as the transcript stores it, as JSON text, one assistant entry per piece
function storeTurn(turn: Turn) {
  return JSON.stringify(turn.pieces.map(piece => piece.content))
}

function replayTurn(stored: string, reorder = false): BetaMessageParam[] {
  const pieces = JSON.parse(stored) as BetaContentBlock[][]

  return pieces.map(content => ({
    role: 'assistant',
    content: reorder
      ? content.map(block => (block.type === 'tool_use' ? { ...block, input: reorderKeysAsJsonb(block.input) } : block))
      : content,
  }))
}

// The member's answer to every recorded decision, which carries the conversation on
function answerDecisions(turn: Turn): BetaMessageParam {
  return {
    role: 'user',
    content: readDecisions(turn).map(block => ({
      type: 'tool_result' as const,
      tool_use_id: block.id,
      content: '{"recorded":true}',
    })),
  }
}

// A value with its objects' keys in the order Postgres `jsonb` stores them: shorter first, then by bytes
function reorderKeysAsJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeysAsJsonb)
  if (!value || typeof value !== 'object') return value

  const keys = Object.keys(value).sort(
    (a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b)),
  )

  return Object.fromEntries(keys.map(key => [key, reorderKeysAsJsonb((value as Record<string, unknown>)[key])]))
}

// A one-page PDF reading "Strategy Dance probe", built here so the repository holds no binary
function buildPdf() {
  const text = 'BT /F1 24 Tf 72 720 Td (Strategy Dance probe) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const offsets: number[] = []
  let pdf = '%PDF-1.4\n'

  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xref = pdf.length

  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

/* ---
  REQUEST 1: THE AGENT'S FIRST REQUEST
--- */

let first: Turn | null = null

await check('Request 1 is accepted with every field and beta together, fallbacks included', async () => {
  first = await runTurn(FIRST_MESSAGES)
})

// Read through a constant, since TypeScript cannot tell the check above assigned it
const firstTurn = first as Turn | null

if (firstTurn) {
  const last = firstTurn.pieces.at(-1) as BetaMessage
  const blocks = readBlocks(firstTurn)

  await check(`Request 1 is served by ${MODEL}`, () => {
    assert(
      firstTurn.pieces.every(piece => piece.model === MODEL),
      `served by ${firstTurn.pieces.map(piece => piece.model).join(', ')}`,
    )
  })

  await check('Web search runs, and returns results', () => {
    const search = blocks.find(
      (block): block is BetaServerToolUseBlock => block.type === 'server_tool_use' && block.name === 'web_search',
    )
    const result = blocks.find(
      block => block.type === 'web_search_tool_result' && search && block.tool_use_id === search.id,
    )

    assert(search, 'no web_search call')
    assert(result && result.type === 'web_search_tool_result', 'no result for the web_search call')
    assert(Array.isArray(result.content), `the search failed: ${JSON.stringify(result.content)}`)
  })

  await check('Request 1 ends on record_decision, its input keys out of alphabetical order', () => {
    const [decision] = readDecisions(firstTurn)

    assert(last.stop_reason === 'tool_use', `stop_reason ${last.stop_reason}`)
    assert(decision, 'no record_decision call')

    const keys = Object.keys(decision.input as object)

    assert(keys.join() !== [...keys].sort().join(), `keys in alphabetical order: ${keys.join(', ')}`)

    return keys.join(', ')
  })

  await check('Request 1 reports input_transformations, empty', () => {
    assert(
      firstTurn.pieces.every(piece => Array.isArray(piece.input_transformations)),
      'input_transformations missing',
    )
    assert(!readTransformations(firstTurn).length, JSON.stringify(readTransformations(firstTurn)))
  })

  // Progress lines are not promised: in a turn of server tool calls the model's notes, when it
  // writes any, come as text blocks, and its thinking blocks stay empty. The thread draws the one,
  // and the indicator falls back to the running tool's label without the other
  finding(
    'Request 1 progress lines (thinking blocks with text)',
    blocks.flatMap(block => (block.type === 'thinking' && block.thinking.trim() ? [block.thinking] : [])),
  )
  finding(
    'Request 1 blocks, in order',
    blocks.map(block =>
      block.type === 'server_tool_use' || block.type === 'tool_use' ? `${block.type}:${block.name}` : block.type,
    ),
  )
  finding('Request 1 usage, per piece', readUsage(firstTurn))
  finding('Request 1 pauses', firstTurn.pieces.length - 1)
  finding('Request 1 input_json deltas (eager input streaming)', firstTurn.inputJsonDeltas)
  finding(
    'Request 1 server tool calls',
    blocks.flatMap(block => (block.type === 'server_tool_use' ? [block.name] : [])),
  )
  finding(
    'Request 1 decision input',
    readDecisions(firstTurn).map(block => block.input),
  )
} else {
  for (const name of ['the model serving it', 'web search', 'the tool call', 'input_transformations']) {
    skip(`Request 1: ${name}`, 'request 1 failed')
  }
}

/* ---
  REQUESTS 2 AND 3: REPLAYS FROM THE STORED TRANSCRIPT
--- */

const stored = firstTurn && readDecisions(firstTurn).length ? storeTurn(firstTurn) : null

let replay: BetaMessageParam[] | null = null

if (firstTurn && stored) {
  const answer = answerDecisions(firstTurn)
  const replayed = [...FIRST_MESSAGES, ...replayTurn(stored), answer]

  replay = replayed

  await check(
    'Request 2, replaying turn 1 from its JSON text, is accepted with nothing dropped and a cache read',
    async () => {
      const second = await runTurn(replayed)
      const usage = readUsage(second)

      finding('Request 2 usage, per piece', usage)
      finding('Request 2 input_transformations', readTransformations(second))

      assert(!readTransformations(second).length, 'input_transformations not empty')
      assert(usage[0].cacheRead, 'cache_read_input_tokens is 0')
    },
  )

  // Whether the API counts key order as an edit: either answer settles it, a drop or a refusal
  await check('Request 3, replaying turn 1 with its tool input reordered as jsonb would, gets an answer', async () => {
    const reordered = replayTurn(stored, true)

    assert(
      JSON.stringify(reordered) !== JSON.stringify(replayTurn(stored)),
      'the decision input already came in jsonb order, so nothing was reordered',
    )

    try {
      const third = await runTurn([...FIRST_MESSAGES, ...reordered, answer])

      finding('Request 3 input_transformations', readTransformations(third))
      finding('Request 3 usage, per piece', readUsage(third))
    } catch (error) {
      if (!(error instanceof Anthropic.BadRequestError)) throw error

      finding('Request 3 refused', describeError(error))
    }
  })
} else {
  skip('Request 2: the replay from JSON text', 'request 1 has no record_decision call to answer')
  skip('Request 3: the replay with its tool input reordered', 'request 1 has no record_decision call to answer')
}

/* ---
  FILES, THROUGH THE FILES API, AS THE UPLOAD ROUTE WILL SEND THEM
--- */

const pdf = buildPdf()

const image = Buffer.from(
  await Bun.file(
    new URL('../../strategydance-web/public/assets/images/logo/logo-primary-512.png', import.meta.url),
  ).arrayBuffer(),
)

// count_tokens takes no file id, so the upload route counts a file from the bytes it stored, once
await check('count_tokens counts a PDF and an image from their bytes', async () => {
  const counts = await Promise.all(
    [
      {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdf.toString('base64') },
      },
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/png' as const, data: image.toString('base64') },
      },
    ].map(async block => {
      const { input_tokens } = await client.messages.countTokens({
        model: MODEL,
        messages: [{ role: 'user', content: [block] }],
      })

      return input_tokens
    }),
  )

  finding('PDF tokens (one page), and image tokens (512 by 512 PNG)', counts)
  assert(
    counts.every(count => count > 0),
    'counted 0 tokens',
  )
})

try {
  const { input_tokens } = await client.messages.countTokens({
    model: MODEL,
    messages: [{ role: 'user', content: 'Hi' }],
  })

  finding('Baseline tokens (a message reading "Hi")', input_tokens)
} catch (error) {
  finding('Baseline tokens refused', describeError(error))
}

const uploaded: string[] = []

await check('The Files API takes a PDF, an image and a text file, and a message reads them by their ids', async () => {
  for (const file of [
    await toFile(pdf, 'probe.pdf', { type: 'application/pdf' }),
    await toFile(image, 'logo.png', { type: 'image/png' }),
    // A Markdown file, as a conversation sends one: as plain text, titled with its name in its block
    await toFile(Buffer.from('# Probe notes\n\nThe launch is on a Tuesday.'), 'probe.md', { type: 'text/plain' }),
  ]) {
    uploaded.push((await client.files.upload({ file })).id)
  }

  const [pdfId, imageId, textId] = uploaded

  // The measurement counts each file by what its upload counted, on the word that the count endpoint
  // takes no Files API source: what it answers says whether that still holds
  try {
    const { input_tokens } = await client.messages.countTokens({
      model: MODEL,
      messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'file', file_id: pdfId ?? '' } }] }],
    })

    finding('count_tokens with a Files API source', `accepted: ${input_tokens} tokens`)
  } catch (error) {
    finding('count_tokens with a Files API source', `refused: ${describeError(error)}`)
  }

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'file', file_id: pdfId } },
          { type: 'image', source: { type: 'file', file_id: imageId } },
          { type: 'document', source: { type: 'file', file_id: textId }, title: 'probe.md' },
          {
            type: 'text',
            text: 'In one short sentence each: what does the PDF say, what does the image show, and what day does probe.md name?',
          },
        ],
      },
    ],
  })

  finding('The files read by id: usage', { input: message.usage.input_tokens, output: message.usage.output_tokens })
  finding(
    'The files read by id: reply',
    message.content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join(' '),
  )
  assert(message.stop_reason === 'end_turn', `stop_reason ${message.stop_reason}`)
})

// The probe's files go, as a pruned conversation's will
for (const id of uploaded) {
  try {
    await client.files.delete(id)
  } catch (error) {
    finding(`Deleting file ${id} failed`, describeError(error))
  }
}

/* ---
  THE AGENT'S OWN REQUEST, ITS TOOLS AND ITS MODULES'
--- */

// The tools a run's requests send, which the checks after the first send too, and the modules'
// tools they end with, which a subagent's list is built from
let agentTools: ConversationRequestTools = []
let moduleTools: Parameters<typeof buildSubagentTools>[0] = []

await check(
  "The agent's own request is accepted, with its system prompt and every tool it sends, the modules' included",
  async () => {
    // The modules' tools as a run's worker lists them, for a member nobody is: listing reads nothing
    const modules = await connectConversationModules({
      organizationId: '00000000000000000000000000000000',
      userId: 'probe',
      conversationId: '00000000000000000000000000000000',
      membershipCreatedAt: new Date().toISOString(),
    })

    await modules.close()

    moduleTools = modules.tools
    agentTools = buildConversationTools(modules.tools)

    const request = buildConversationRequest([{ role: 'user', content: 'Answer with one word: ready.' }], {
      system: CONVERSATION_SYSTEM_PROMPT,
      tools: agentTools,
    })
    const message = await client.beta.messages.stream(request).finalMessage()

    finding("The agent's request's usage", message.usage)
    assert(message.stop_reason !== 'refusal', 'the request was refused')

    // As a conversation's next request does, reading the system prompt and the tools from the cache
    const again = await client.beta.messages.stream(request).finalMessage()

    finding("The agent's request sent again: its usage", again.usage)
    assert(again.usage.cache_read_input_tokens, 'the second request read nothing from the cache')

    return `${agentTools.length} tools, stopped on ${message.stop_reason}`
  },
)

await check("The modules' tools are counted, what each adds to every request", async () => {
  assert(agentTools.length, 'no tools listed')

  // What the system prompt and the tools take of a request, as the worker counts it
  const count = async (tools: ConversationRequestTools) => {
    const messages: BetaMessageParam[] = [{ role: 'user', content: '.' }]
    const [withConfig, without] = await Promise.all([
      client.beta.messages.countTokens({
        model: CONVERSATION_MODEL,
        system: CONVERSATION_SYSTEM_PROMPT,
        tools,
        messages,
      }),
      client.beta.messages.countTokens({ model: CONVERSATION_MODEL, messages }),
    ])

    return withConfig.input_tokens - without.input_tokens
  }

  const ownTools = buildConversationTools([])
  const own = await count(ownTools)
  const all = await count(agentTools)
  const each: Record<string, number> = {}

  for (const tool of agentTools.slice(ownTools.length)) {
    if ('name' in tool) each[tool.name] = (await count([...ownTools, tool])) - own
  }

  // The whole tools list alone, M29's integration tools and the Subagents module's included, against
  // the 10000 at which Later modules weighs Claude's tool search
  const messages: BetaMessageParam[] = [{ role: 'user', content: '.' }]
  const [withTools, withoutTools] = await Promise.all([
    client.beta.messages.countTokens({ model: CONVERSATION_MODEL, tools: agentTools, messages }),
    client.beta.messages.countTokens({ model: CONVERSATION_MODEL, messages }),
  ])
  const list = withTools.input_tokens - withoutTools.input_tokens

  finding('The system prompt and the agent’s own tools, in tokens', own)
  finding('The modules’ tools, in tokens', all - own)
  finding('The whole tools list alone, the agent’s own and the modules’, in tokens', list)
  finding('What each module tool adds alone, in tokens', each)

  return `${own} tokens, then ${all - own} for the modules' tools, ${list} for the whole list alone`
})

await check("A module's tool, which is not strict, is called with an input its schema names", async () => {
  assert(agentTools.length, 'no tools listed')

  const message = await client.beta.messages
    .stream(
      buildConversationRequest([{ role: 'user', content: 'Which tasks are in the To do column of our board?' }], {
        system: CONVERSATION_SYSTEM_PROMPT,
        tools: agentTools,
      }),
    )
    .finalMessage()
  const call = message.content.find((block): block is BetaToolUseBlock => block.type === 'tool_use')
  const tool = agentTools.find(item => 'name' in item && item.name === 'list_tasks')
  const properties = tool && 'input_schema' in tool ? Object.keys(tool.input_schema.properties ?? {}) : []
  const input = (call?.input ?? {}) as Record<string, unknown>

  finding('The call', call ? { name: call.name, input } : message.stop_reason)
  assert(call?.name === 'list_tasks', `called ${call?.name ?? 'no tool'}`)
  assert(
    Object.keys(input).every(key => properties.includes(key)),
    `sent ${Object.keys(input).join(', ')}, beyond what list_tasks names`,
  )
  assert(input.status === undefined || input.status === 'TODO', `asked for the status ${String(input.status)}`)

  return JSON.stringify(input)
})

await check(
  'The integration call tool, which is not strict, is called with its arguments as an object its tool names',
  async () => {
    assert(agentTools.length, 'no tools listed')

    const message = await client.beta.messages
      .stream(
        buildConversationRequest(
          [
            {
              role: 'user',
              content:
                'Our issue tracker is the integration 7c9e6679742540de944be07fc1f90ae7. Its tool create_issue takes { "title": string, "labels": string[] }. Create an issue titled "Fix the login" labelled "bug" with it now: I know it, so do not list or describe anything first.',
            },
          ],
          { system: CONVERSATION_SYSTEM_PROMPT, tools: agentTools },
        ),
      )
      .finalMessage()
    const call = message.content.find((block): block is BetaToolUseBlock => block.type === 'tool_use')
    const input = (call?.input ?? {}) as Record<string, unknown>
    const args = input.arguments as Record<string, unknown> | undefined

    finding('The call', call ? { name: call.name, input } : message.stop_reason)
    assert(call?.name === 'call_integration_tool', `called ${call?.name ?? 'no tool'}`)
    assert(input.integration === '7c9e6679742540de944be07fc1f90ae7', `named ${String(input.integration)}`)
    assert(input.tool === 'create_issue', `named the tool ${String(input.tool)}`)
    assert(
      typeof args === 'object' && args !== null && !Array.isArray(args),
      'sent its arguments otherwise than as an object',
    )
    assert(args?.title === 'Fix the login', `sent the title ${String(args?.title)}`)

    return JSON.stringify(input)
  },
)

await check(
  "A subagent's request is accepted, with its own system prompt and tools, the integration tools in, the deletes left out",
  async () => {
    assert(moduleTools.length, 'no module tools listed')

    const tools = buildSubagentTools(moduleTools)
    const names = tools.map(tool => ('name' in tool ? tool.name : tool.type))
    const message = await client.beta.messages
      .stream(
        buildConversationRequest([{ role: 'user', content: 'Your brief: answer with one word, ready.' }], {
          system: SUBAGENT_SYSTEM_PROMPT,
          tools,
          settings: readSubagentRequestSettings(),
        }),
      )
      .finalMessage()

    finding("The subagent's request's usage", message.usage)
    assert(message.stop_reason !== 'refusal', 'the request was refused')
    assert(!names.includes('delete_task') && !names.includes('launch_subagent'), 'it sends a tool it never gets')
    assert(
      !names.includes('ask_user') && names.includes('call_integration_tool'),
      'it sends ask_user, or not the integration tools',
    )

    return `${tools.length} tools, stopped on ${message.stop_reason}`
  },
)

await check('The agent hands work to a subagent through the whole list, with a title and a brief', async () => {
  assert(agentTools.length, 'no tools listed')

  const message = await client.beta.messages
    .stream(
      buildConversationRequest(
        [
          {
            role: 'user',
            content:
              'Hand the research of the pricing pages of Linear, Notion and Asana to a subagent now, one subagent for the three: I need you free meanwhile. Do not read the knowledge or the board first.',
          },
        ],
        { system: CONVERSATION_SYSTEM_PROMPT, tools: agentTools },
      ),
    )
    .finalMessage()
  const call = message.content.find((block): block is BetaToolUseBlock => block.type === 'tool_use')
  const input = (call?.input ?? {}) as Record<string, unknown>

  finding('The call', call ? { name: call.name, input } : message.stop_reason)
  assert(call?.name === 'launch_subagent', `called ${call?.name ?? 'no tool'}`)
  assert(typeof input.title === 'string' && !input.title.includes('\n'), 'sent no one-line title')
  assert(typeof input.brief === 'string' && input.brief.length > 40, 'sent no brief worth the name')

  return JSON.stringify(input)
})

await check('The agent takes a task up from the column it read it in before it hands it to a subagent', async () => {
  assert(agentTools.length, 'no tools listed')

  const message = await client.beta.messages
    .stream(
      buildConversationRequest(
        [
          {
            role: 'user',
            content:
              'I just read the board for you: the task 7c9e6679742540de944be07fc1f90ae7, "Draft the onboarding email", is assigned to Strategy Dance and sits in To do. Do not read it again. Take it up now and hand it to a subagent.',
          },
        ],
        { system: CONVERSATION_SYSTEM_PROMPT, tools: agentTools },
      ),
    )
    .finalMessage()
  const calls = message.content.filter((block): block is BetaToolUseBlock => block.type === 'tool_use')
  const [first] = calls
  const input = (first?.input ?? {}) as Record<string, unknown>

  finding(
    'The calls',
    calls.map(({ name, input: callInput }) => ({ name, input: callInput })),
  )
  assert(first?.name === 'update_task', `called ${first?.name ?? 'no tool'} first`)
  assert(input.status === 'ONGOING', `moved it to ${String(input.status)}`)
  assert(input.fromStatus === 'TODO', `named the column ${String(input.fromStatus)}`)
  finding(
    'It launched nothing before the move went through',
    calls.findIndex(({ name }) => name === 'launch_subagent') !== 0,
  )

  return JSON.stringify(input)
})

/* ---
  THE TAGGING REQUEST
--- */

await check('The tagging request is accepted, counted, and answers one to three aspects its schema holds', async () => {
  const request = buildConversationTaggingRequest({
    member: [{ type: 'text', text: 'How should I price the beta of my scheduling app for small clinics?' }],
    reply: [
      {
        type: 'text',
        text: 'Start with one flat plan per clinic, 49 euros a month, with a free month to try it. Charge per seat later, once you know how many people use it at each clinic.',
      },
    ],
  })
  // As the worker counts it, its schema included
  const counted = await client.beta.messages.countTokens({
    model: request.model,
    system: request.system,
    messages: request.messages,
    output_config: request.output_config,
  })
  const message = await client.beta.messages.stream(request).finalMessage()
  const answer = message.content.map(block => (block.type === 'text' ? block.text : '')).join('')

  finding("The tagging request's count, then its usage", { counted: counted.input_tokens, usage: message.usage })
  finding("The tagging request's count is its billed input", counted.input_tokens === message.usage.input_tokens)
  finding("The tagging request's answer", answer)
  assert(message.stop_reason === 'end_turn', `it stopped on ${message.stop_reason}`)

  const aspects = readConversationTagging(message)

  assert(aspects, 'it answered no aspect its schema holds')
  finding(
    'The tagging of a pricing exchange holds FINANCES or SALES',
    aspects.some(aspect => aspect === 'FINANCES' || aspect === 'SALES'),
  )

  return aspects.join(', ')
})

/* ---
  THE REFUSAL FALLBACK, CHOSEN BY THE API
--- */

let targets: string[] = []

await check(`${MODEL} lists the models a refusal may fall back to`, async () => {
  const model = await client.beta.models.retrieve(MODEL, { betas: ['server-side-fallback-2026-06-01'] })

  targets = model.allowed_fallback_models ?? []

  finding('Allowed fallback models', targets)
  assert(targets.length, 'no allowed fallback models')
})

// A fallback model runs the same request, so each has to take the agent's body as it is
for (const target of targets) {
  await check(`${target} takes request 1's body`, async () => {
    try {
      const turn = await runTurn(FIRST_MESSAGES, { model: target })

      finding(`${target} on request 1: stop_reason`, turn.pieces.at(-1)?.stop_reason)
    } catch (error) {
      if (!(error instanceof Anthropic.BadRequestError)) throw error

      // What it would take for this model to take the request
      for (const [name, thinking] of [
        ['without thinking.display', ['block_binding']],
        ['without thinking.block_binding', ['display']],
        ['without both', []],
      ] as const) {
        try {
          await runTurn(FIRST_MESSAGES, { model: target, thinking })
          finding(`${target} on request 1 ${name}`, 'accepted')
        } catch (variantError) {
          finding(`${target} on request 1 ${name}`, describeError(variantError))
        }
      }

      throw error
    }
  })

  const replayed = replay as BetaMessageParam[] | null

  if (!replayed) {
    skip(`${target} on request 2's body`, 'request 2 was never built')

    continue
  }

  await check(`${target} takes request 2's body, ${MODEL}'s thinking in it`, async () => {
    const turn = await runTurn(replayed, { model: target })

    finding(`${target} on request 2: input_transformations`, readTransformations(turn))
  })
}

await check(`The cost limit prices every model ${MODEL} may fall back to, and reserves the same list`, () => {
  const listed = CLAUDE_FALLBACK_MODELS[MODEL] ?? []

  assert(
    targets.every(target => CLAUDE_MODEL_PRICES[target]),
    `unpriced: ${targets.filter(target => !CLAUDE_MODEL_PRICES[target]).join(', ')}`,
  )
  assert(
    [...targets].sort().join() === [...listed].sort().join(),
    `the API lists ${targets.join(', ')}, CLAUDE_FALLBACK_MODELS ${listed.join(', ')}`,
  )
})

/* ---
  THE COST LIMIT: A REQUEST WITHOUT ITS FALLBACK, AND WHAT A SEARCH BRINGS BACK
--- */

const replayedForCache = replay as BetaMessageParam[] | null

if (replayedForCache) {
  // A request near the run's limit is sent without `fallbacks`, its betas the same
  await check('A request sent without fallbacks reads the cache the replay with them wrote', async () => {
    const { fallbacks: _fallbacks, ...body } = buildBody(replayedForCache)
    const message = await client.beta.messages.stream(body).finalMessage()

    finding('The replay without fallbacks: usage', message.usage)
    assert(message.usage.cache_read_input_tokens, 'cache_read_input_tokens is 0')
  })
} else {
  skip('A request sent without fallbacks reads the cache', 'request 2 was never built')
}

// Questions that take a few searches each, whose answers change, so nothing cached answers them
const SEARCH_PROMPTS = [
  "Search the web for the monthly price per seat of Linear's Business plan, Notion's Business plan and Asana's Advanced plan today, one search for each, then list the three.",
  'Search the web for the three latest announcements on the Anthropic news page, then say each in one line.',
  'Search the web for the population of Lyon, Marseille and Toulouse in the latest census, one search for each city, then list them.',
]

const SEARCH_SYSTEM_PROMPT = 'You answer briefly. Search the web as the member asks, then answer from what you found.'

const SEARCH_TOOLS: BetaMessageStreamParams['tools'] = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
]

/*
  What one request's searches brought back, in input tokens, past what reading its input once per
  search and once more would bill: all the request billed as input, cache reads and writes included,
  less its input as counted times its searches and one, over its searches. What earlier results and
  outputs are read again by each later step of the search loop counts in, so it is more than a
  search's results alone, which is what the cost limit's allowance has to hold
*/
const retrieved: number[] = []

for (const [index, prompt] of SEARCH_PROMPTS.entries()) {
  await check(`Search request ${index + 1} bills no more than its reservation allows a search`, async () => {
    const messages: BetaMessageParam[] = [{ role: 'user', content: prompt }]
    const counted = await client.beta.messages.countTokens({
      model: MODEL,
      system: SEARCH_SYSTEM_PROMPT,
      tools: SEARCH_TOOLS,
      messages,
    })
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: SEARCH_SYSTEM_PROMPT,
        tools: SEARCH_TOOLS,
        messages,
      })
      .finalMessage()
    const { usage } = message
    const searches = usage.server_tool_use?.web_search_requests ?? 0
    const billed = usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
    const perSearch = searches ? (billed - counted.input_tokens * (searches + 1)) / searches : 0

    finding(`Search request ${index + 1}`, {
      counted: counted.input_tokens,
      billed,
      searches,
      perSearch: Math.round(perSearch),
      stopReason: message.stop_reason,
      iterations: (usage.iterations ?? []).map(iteration => ({
        type: iteration.type,
        input: 'input_tokens' in iteration ? iteration.input_tokens : null,
        cacheRead: 'cache_read_input_tokens' in iteration ? iteration.cache_read_input_tokens : null,
        cacheWrite: 'cache_creation_input_tokens' in iteration ? iteration.cache_creation_input_tokens : null,
      })),
    })

    assert(searches, 'it made no search')

    retrieved.push(perSearch)

    assert(
      perSearch <= WEB_SEARCH_RESULT_TOKEN_ALLOWANCE,
      `${Math.round(perSearch)} tokens a search, past the ${WEB_SEARCH_RESULT_TOKEN_ALLOWANCE} allowed`,
    )

    return `${Math.round(perSearch)} tokens a search`
  })
}

if (retrieved.length) finding('The most a search brought back, past its readings of the input', Math.max(...retrieved))

const FIVE_SEARCHES_PROMPT =
  'Search the web for the population of Lyon, Marseille, Toulouse, Nice and Nantes in the latest census, one separate search for each city, then list the five.'

/*
  A request of five searches, the most one makes, read step by step through `usage.iterations`: what
  each step read past the one before is a search's result read the first time, with what the model
  wrote between, which the allowance has to hold, and everything billed as input, every step reading
  the input and every result and output before it again, has to fit what the worst case reserves of
  input for five searches (`priceAttemptWorstCase`, its searches' own price left out)
*/
await check('A request of five searches bills its input within what its worst case reserves for them', async () => {
  const messages: BetaMessageParam[] = [{ role: 'user', content: FIVE_SEARCHES_PROMPT }]
  const counted = await client.beta.messages.countTokens({
    model: MODEL,
    system: SEARCH_SYSTEM_PROMPT,
    tools: SEARCH_TOOLS,
    messages,
  })
  const message = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      system: SEARCH_SYSTEM_PROMPT,
      tools: SEARCH_TOOLS,
      messages,
    })
    .finalMessage()
  const { usage } = message
  const price = CLAUDE_MODEL_PRICES[MODEL]

  assert(price, `${MODEL} has no price`)

  const searches = usage.server_tool_use?.web_search_requests ?? 0
  const billed =
    usage.input_tokens * price.input
    + (usage.cache_read_input_tokens ?? 0) * price.cacheRead
    + (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite
  const reserved =
    priceAttemptWorstCase(MODEL, { inputTokens: counted.input_tokens, maxTokens: 0, maxSearches: searches })
    - searches * WEB_SEARCH_PRICE_MICRODOLLARS
  const steps = (usage.iterations ?? []).flatMap(iteration =>
    iteration.type === 'message'
      ? [
          iteration.input_tokens
            + (iteration.cache_read_input_tokens ?? 0)
            + (iteration.cache_creation_input_tokens ?? 0),
        ]
      : [],
  )
  const firstReadings = steps.slice(1).map((step, index) => step - (steps[index] ?? 0))

  finding('A request of five searches', {
    counted: counted.input_tokens,
    searches,
    billedMicrodollars: Math.round(billed),
    reservedMicrodollars: Math.round(reserved),
    steps,
    firstReadings,
  })

  assert(searches >= 4, `it made ${searches} searches`)
  assert(
    billed <= reserved,
    `its input billed ${Math.round(billed)} microdollars, past the ${Math.round(reserved)} reserved`,
  )

  for (const reading of firstReadings) {
    assert(
      reading <= WEB_SEARCH_RESULT_TOKEN_ALLOWANCE,
      `a step read ${reading} tokens past the one before, past the ${WEB_SEARCH_RESULT_TOKEN_ALLOWANCE} allowed a result`,
    )
  }

  return `${searches} searches, ${Math.round(billed)} of ${Math.round(reserved)} microdollars of input, the most a step read anew ${Math.max(0, ...firstReadings)} tokens`
})

await check('Every model writes within half the top rate a cut stream is bounded by', () => {
  finding('The fastest each model wrote, in output tokens a second', Object.fromEntries(outputRates))

  assert(outputRates.size, 'no stream wrote 100 tokens to measure')

  for (const [model, rate] of outputRates) {
    const top = CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND[model]

    assert(top, `${model} has no top rate`)
    assert(rate * 2 <= top, `${model} wrote ${Math.round(rate)} tokens a second, past half its ${top}`)
  }

  return [...outputRates].map(([model, rate]) => `${model} ${Math.round(rate)}/s`).join(', ')
})

/* ---
  SUMMARY
--- */

const failures = results.filter(({ outcome }) => outcome !== 'pass')

console.log('\nChecks')

for (const { name, outcome, detail } of results) {
  console.log(
    `  ${{ pass: '✓', fail: '✗', skip: '-' }[outcome]} ${name}${detail && outcome !== 'pass' ? `: ${detail}` : ''}`,
  )
}

console.log('\nFindings')

for (const [name, value] of findings) console.log(`  ${name}: ${JSON.stringify(value)}`)

if (failures.length) {
  console.error(`\n${failures.length} check(s) did not pass: ${failures.map(({ name }) => name).join('; ')}`)
  process.exit(1)
}

console.log(`\nEvery check passed in ${((Date.now() - startedAt) / 1000).toFixed(0)}s`)
