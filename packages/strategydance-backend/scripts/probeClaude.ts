import Anthropic, { toFile } from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  BetaMessageStreamParams,
  BetaServerToolUseBlock,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

import { SECRET_ANTHROPIC_API_KEY } from '~constants'

import retrieveSecret from '~utils/retrieveSecret'

/*
  Checks, against Claude's API itself, the facts the conversations agent is built on, which no test
  without the real model can confirm:

    bun run probe:claude

  It sends the request the agent will send (conversations.md, The agent), streamed: adaptive
  thinking with progress updates and `drop_block`, explicit effort, server-side refusal fallbacks,
  a strict tool with eager input streaming, web search, top-level caching and the context message
  last. Then it replays that turn from its JSON text, as the transcript stores it, and again with the
  tool's input reordered as Postgres `jsonb` would reorder it; uploads a PDF and an image through the
  Files API and counts their tokens by id, as the upload route will; and sends the first request and
  the replay straight to each model a refusal may fall back to. It prints what passed, what failed
  and what it found, and exits non-zero naming every check that did not pass.

  It calls the real model, so it costs money, under a dollar a run: run it after an Anthropic SDK
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
    'Request 1 server tool calls',
    blocks.flatMap(block => (block.type === 'server_tool_use' ? [block.name] : [])),
  )
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

const uploaded: string[] = []

await check('The Files API takes a PDF, and count_tokens counts it by its id', async () => {
  const file = await client.files.upload({ file: await toFile(buildPdf(), 'probe.pdf', { type: 'application/pdf' }) })

  uploaded.push(file.id)

  const { input_tokens } = await client.messages.countTokens({
    model: MODEL,
    messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'file', file_id: file.id } }] }],
  })

  finding('PDF tokens (one page)', input_tokens)
  assert(input_tokens > 0, 'counted 0 tokens')
})

await check('The Files API takes an image, and count_tokens counts it by its id', async () => {
  const image = await Bun.file(
    new URL('../../strategydance-web/public/assets/images/logo/logo-primary-512.png', import.meta.url),
  ).arrayBuffer()
  const file = await client.files.upload({
    file: await toFile(Buffer.from(image), 'logo.png', { type: 'image/png' }),
  })

  uploaded.push(file.id)

  const { input_tokens } = await client.messages.countTokens({
    model: MODEL,
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'file', file_id: file.id } }] }],
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

// The probe's files go, as a pruned conversation's will
for (const id of uploaded) {
  try {
    await client.files.delete(id)
  } catch (error) {
    finding(`Deleting file ${id} failed`, describeError(error))
  }
}

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
