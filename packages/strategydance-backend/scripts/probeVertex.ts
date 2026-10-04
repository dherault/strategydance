import Anthropic, { BetaFallbackState, betaRefusalFallbackMiddleware } from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  BetaMessageStreamParams,
  BetaServerToolUseBlock,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { AnthropicVertex, type ClientOptions } from '@anthropic-ai/vertex-sdk'

import { FIREBASE_PROJECT_ID } from '~constants'

/*
  Checks, against Claude on Vertex itself, the facts the conversations agent is built on, which no
  test without the real model can confirm:

    bun run probe:vertex

  It sends the request the agent will send (conversations.md, The agent), streamed: adaptive
  thinking with progress updates and `drop_block`, explicit effort, a strict tool with eager input
  streaming, web search, top-level caching and the context message last. Then it replays that turn
  from its JSON text, as the transcript stores it, and again with the tool's input reordered as
  Postgres `jsonb` would reorder it; counts the tokens of a PDF and an image, as the upload route
  will; and sends the first request and the replay to the refusal fallback, Claude Opus 5, as the
  middleware would. It prints what passed, what failed and what it found, and exits non-zero naming
  every check that did not pass.

  It calls the real model, so it costs money, a few tens of cents a run: run it after an Anthropic
  SDK bump or a change of model, never in CI. It authenticates with Application Default
  Credentials, or with `VERTEX_ACCESS_TOKEN` when that is set, for a machine whose ADC belongs to
  another account or has expired:

    VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token) bun run probe:vertex
*/

const MODEL = 'claude-opus-5-5'

const FALLBACK_MODEL = 'claude-opus-5'

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
  { type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
]

const FIRST_MESSAGES: BetaMessageParam[] = [
  { role: 'user', content: FIRST_MESSAGE },
  { role: 'system', content: CONTEXT_MESSAGE },
]

type Result = { name: string; outcome: 'pass' | 'fail' | 'skip'; detail?: string }

// A turn as it comes back: its pieces, more than one when web search paused it
type Turn = { pieces: BetaMessage[]; inputJsonDeltas: number }

type Transform = (body: BetaMessageStreamParams) => BetaMessageStreamParams

const results: Result[] = []

const findings: [string, unknown][] = []

const startedAt = Date.now()

const client = new AnthropicVertex({
  projectId: FIREBASE_PROJECT_ID,
  region: 'global',
  authClient: createAccessTokenClient(process.env.VERTEX_ACCESS_TOKEN),
  middleware: [betaRefusalFallbackMiddleware([{ model: FALLBACK_MODEL }])],
})

/*
  An auth client that hands the Vertex client a token it was given, or nothing, so that it falls
  back to Application Default Credentials. The client's own `accessToken` option is stored and never
  read: every request asks an auth client for its headers, and that is all this one answers
*/
function createAccessTokenClient(token: string | undefined) {
  if (!token) return null

  const client = { getRequestHeaders: async () => new Headers({ Authorization: `Bearer ${token}` }) }

  return client as unknown as NonNullable<ClientOptions['authClient']>
}

function buildBody(messages: BetaMessageParam[]): BetaMessageStreamParams {
  return {
    model: MODEL,
    max_tokens: 64000,
    betas: ['thinking-display-updates-2026-08-18', 'thinking-binding-controls-2026-08-01'],
    thinking: { type: 'adaptive', display: 'updates', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
    output_config: { effort: 'medium' },
    cache_control: { type: 'ephemeral' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: TOOLS,
    messages,
  }
}

// One turn, streamed, each piece a paused turn sent back as it is, progress lines logged as they land
async function runTurn(
  messages: BetaMessageParam[],
  fallbackState: BetaFallbackState,
  transform: Transform = body => body,
) {
  const turn: Turn = { pieces: [], inputJsonDeltas: 0 }
  let sent = messages

  for (;;) {
    const stream = client.beta.messages.stream(transform(buildBody(sent)), { fallbackState })

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

// Whether a message was served by a model, which Vertex may name with a version after an `@`
function isServedBy(message: BetaMessage, model: string) {
  return message.model === model || message.model.startsWith(`${model}@`)
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

  return Buffer.from(pdf, 'latin1').toString('base64')
}

// A state that sends every request straight to the first fallback, as after a refusal
function createPinnedFallbackState() {
  const state = new BetaFallbackState()

  state.index = 0

  return state
}

function withoutThinkingFields(...fields: ('display' | 'block_binding')[]): Transform {
  return body => ({
    ...body,
    thinking: {
      type: 'adaptive',
      ...(fields.includes('display') ? {} : { display: 'updates' }),
      ...(fields.includes('block_binding') ? {} : { block_binding: { prefix_mismatch_behavior: 'drop_block' } }),
    },
  })
}

/* ---
  REQUEST 1: THE AGENT'S FIRST REQUEST
--- */

let first: Turn | null = null

await check('Request 1 is accepted on Vertex with every field and beta together', async () => {
  first = await runTurn(FIRST_MESSAGES, new BetaFallbackState())
})

// Read through a constant, since TypeScript cannot tell the check above assigned it
const firstTurn = first as Turn | null

if (firstTurn) {
  const last = firstTurn.pieces.at(-1) as BetaMessage
  const blocks = readBlocks(firstTurn)

  await check(`Request 1 is served by ${MODEL}`, () => {
    assert(
      firstTurn.pieces.every(piece => isServedBy(piece, MODEL)),
      `served by ${firstTurn.pieces.map(piece => piece.model).join(', ')}`,
    )
  })

  await check('Progress lines arrive as thinking blocks with text', () => {
    assert(
      blocks.some(block => block.type === 'thinking' && block.thinking.trim()),
      'no thinking block carries text',
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

  finding('Request 1 usage, per piece', readUsage(firstTurn))
  finding('Request 1 pauses', firstTurn.pieces.length - 1)
  finding('Request 1 input_json deltas (eager input streaming)', firstTurn.inputJsonDeltas)
  finding(
    'Request 1 decision input',
    readDecisions(firstTurn).map(block => block.input),
  )
} else {
  for (const name of [
    'the model serving it',
    'progress lines',
    'web search',
    'the tool call',
    'input_transformations',
  ]) {
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
      const second = await runTurn(replayed, new BetaFallbackState())
      const usage = readUsage(second)

      finding('Request 2 usage, per piece', usage)
      finding('Request 2 input_transformations', readTransformations(second))

      assert(!readTransformations(second).length, 'input_transformations not empty')
      assert(usage[0].cacheRead, 'cache_read_input_tokens is 0')
    },
  )

  const reordered = replayTurn(stored, true)
  const isReordered = JSON.stringify(reordered) !== JSON.stringify(replayTurn(stored))

  finding('Request 3 reorders the decision input', isReordered)

  if (isReordered) {
    try {
      const third = await runTurn([...FIRST_MESSAGES, ...reordered, answer], new BetaFallbackState())

      finding('Request 3 (keys reordered as jsonb) input_transformations', readTransformations(third))
      finding('Request 3 usage, per piece', readUsage(third))
    } catch (error) {
      finding('Request 3 (keys reordered as jsonb) refused', describeError(error))
    }
  }
} else {
  skip('Request 2: the replay from JSON text', 'request 1 has no record_decision call to answer')
}

/* ---
  COUNTING TOKENS, AS THE UPLOAD ROUTE WILL
--- */

await check('count_tokens counts a PDF', async () => {
  const { input_tokens } = await client.messages.countTokens({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buildPdf() } }],
      },
    ],
  })

  finding('PDF tokens (one page)', input_tokens)
  assert(input_tokens > 0, 'counted 0 tokens')
})

await check('count_tokens counts an image', async () => {
  const image = await Bun.file(
    new URL('../../strategydance-web/public/assets/images/logo/logo-primary-512.png', import.meta.url),
  ).arrayBuffer()
  const { input_tokens } = await client.messages.countTokens({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: Buffer.from(image).toString('base64') },
          },
        ],
      },
    ],
  })

  finding('Image tokens (512 by 512 PNG)', input_tokens)
  assert(input_tokens > 0, 'counted 0 tokens')
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

/* ---
  THE REFUSAL FALLBACK, CLAUDE OPUS 5, SENT THE SAME BODY
--- */

await check(`${FALLBACK_MODEL} takes request 1's body through the fallback middleware`, async () => {
  try {
    const turn = await runTurn(FIRST_MESSAGES, createPinnedFallbackState())

    finding('Fallback request 1 stop_reason', turn.pieces.at(-1)?.stop_reason)
    assert(
      turn.pieces.every(piece => isServedBy(piece, FALLBACK_MODEL)),
      `served by ${turn.pieces.map(piece => piece.model).join(', ')}`,
    )
  } catch (error) {
    if (!(error instanceof Anthropic.BadRequestError)) throw error

    // What would have to be stripped for the fallback to take the request
    for (const [name, transform] of [
      ['without thinking.display', withoutThinkingFields('display')],
      ['without thinking.block_binding', withoutThinkingFields('block_binding')],
      ['without both', withoutThinkingFields('display', 'block_binding')],
    ] as const) {
      try {
        await runTurn(FIRST_MESSAGES, createPinnedFallbackState(), transform)
        finding(`Fallback request 1 ${name}`, 'accepted')
      } catch (variantError) {
        finding(`Fallback request 1 ${name}`, describeError(variantError))
      }
    }

    throw error
  }
})

const replayed = replay as BetaMessageParam[] | null

if (replayed) {
  await check(`${FALLBACK_MODEL} takes request 2's body, ${MODEL}'s thinking in it, without a refusal`, async () => {
    const turn = await runTurn(replayed, createPinnedFallbackState())

    finding('Fallback request 2 input_transformations', readTransformations(turn))
  })
} else {
  skip(`${FALLBACK_MODEL} on request 2's body`, 'request 2 was never built')
}

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
