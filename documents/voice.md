# Voice

Whether members can talk with Strategy Dance as they would with a person, and how: what the
technology offers in October 2026, what it would take in this codebase, what it would cost, and the
recommendation, for David to decide on. Nothing here is built. The user interface is left out on
purpose: this document is about the path, not the screens.

Written on 2026-10-15 against `dev` at `e406150f`, when conversations were built up to M29. Every
external fact was read on 2026-10-15 from the source listed under Sources; where two sources
disagree, both are given. Prices are list prices in US dollars. When a decision is taken, write it
here first.

## The verdict

It is feasible today, with Claude kept as the brain, by adding one voice provider in front of it.

- **Claude cannot hear or speak.** Anthropic's API takes text and images and returns text, and has
  no realtime endpoint. Voice has to come from another provider.
- **The shape that works is a voice front with Claude behind it.** A speech-to-speech model holds
  the conversation itself: it listens while it speaks, notices when the member is done or cuts in,
  answers "mm-hm", greets, asks the member to repeat, and says "let me look at your board" while
  work runs. Anything about the company it hands to Strategy Dance's agent, the same agent as
  today's conversations, with the same prompt, modules, integrations and web search, and speaks
  the answer as it streams back.
- **The recommended front is OpenAI's GPT-Live-1**, the only truly full-duplex product on the
  market and the only one built to sit in front of an agent of one's own, with the server in
  control of the call. Its condition: it has to pass a test in the seven locales, since its voices
  are listed for English and Portuguese only. **Google's Gemini 3.8 Live is the second choice**,
  and the first if the locales matter more than full duplex: it speaks all seven, and Google is
  already a processor of ours.
- **The provider is chosen on measurements**, by a probe run before anything is built (see
  Validating before building), against thresholds written down first.
- **A delegated answer will take about three to five seconds to start being spoken**, covered by
  an acknowledgment within about a second. Small talk is answered in about a second. That is how a
  person sounds when they look something up, which is the bar.
- **It costs roughly $0.75 to $1.00 per ten minutes of talk**, half the voice and half Claude,
  against about $0.15 for a typed run today. It needs caps of its own.
- **It reverses two recorded decisions**: replies would stream, and voice runs would execute
  outside the worker queue. The build is about three to four milestones after the probe.

## What "like a human" takes

| Behaviour | What it means for the system |
| --- | --- |
| Full duplex | It listens while it speaks, so the member can cut in at any moment, and it hears "mm-hm" and "right" without stopping |
| Barge-in | When the member really cuts in, it stops within a few hundred milliseconds, and knows what it had said by then |
| Turn-taking | It starts answering within about a second of the member finishing, without waiting for a long silence, and without jumping in on a pause mid-sentence |
| Fillers | When the answer needs work, it says so at once, then answers when it can, rather than going silent |
| Backchannels | It says "mm-hm" while the member talks at length, so they know it is listening |
| Faithful content | What it says about the company is what the agent found: numbers, names and titles right |
| Seven locales | English, French, Spanish, German, Portuguese, Chinese and Japanese, with a natural accent in each |

A human pause between turns is a few hundred milliseconds; voice agents in 2026 aim for under 1.5
seconds from the end of the member's speech to the first audio (Daily's benchmark, Sources).

## Why Claude cannot do it alone

- Every current Claude model, Haiku 5.5, Sonnet 5.5, Opus 5.5 and Fable 5.1, takes text and images
  in and gives text out. The release notes from January to October 2026 mention no audio input,
  voice or realtime endpoint, and Anthropic's OpenAI-compatible endpoint strips audio input.
- Claude's voice mode exists in Anthropic's own apps and, since March 2026, as dictation in Claude
  Code. Neither is a developer API. Anthropic lists ElevenLabs as the subprocessor of its apps'
  speech, and its own cookbook builds a voice agent as a cascade: ElevenLabs speech to text, Claude
  Haiku, ElevenLabs text to speech, about 1.48 seconds to the first audio, one turn at a time.
- A job posting for Anthropic's Voice Platform team mentions designing a voice mode API surface for
  the Anthropic API, so one may come. Nothing is announced, and nothing here waits for it. Should it
  come, the provider seam below is where it would plug in.

## The options

Measured or published as of 2026-10-15. "Time to first audio" is Artificial Analysis's
speech-to-speech measurement unless said otherwise.

| Option | Full duplex | Claude as the brain | Seven locales | Time to first audio | Per 10 minutes (voice only) | Maturity |
| --- | --- | --- | --- | --- | --- | --- |
| **OpenAI GPT-Live-1** | Yes | Built for it (client delegation) | Unproven: voices listed for English and Portuguese only | 1.24 to 1.34 s; OpenAI's turn-taking figure 0.80 s | $0.50 | GA 2026-09-10, one month old |
| **Google Gemini 3.8 Live** | No, turn-based with barge-in | Through a non-blocking function | Yes (99 languages on the Gemini API page, 24 on Google Cloud's) | 1.18 s | $0.12 nominal, about $0.40 to $0.80 realistic | Stable 2026-09-15 (Gemini API), GA 2026-09-24 (Google Cloud) |
| OpenAI gpt-realtime-2.1 | No, turn-based with barge-in | Through a function | No language list published | 1.21 s (high reasoning) | About $0.45, over $1 when the cache misses; mini about $0.16 | GA, mature |
| Cascade keeping Claude (LiveKit Agents, Deepgram Flux, Claude, Cartesia Sonic) | No, half duplex | Claude is the only brain | Flux lacks Chinese, which needs a second recognizer | About 1.0 to 1.5 s median, 2 to 3 s at p95 | About $0.21 to $0.32, Claude included | GA parts, our assembly |
| xAI Grok Voice 3.0 | No | Through a function or MCP | Listed, among 20+ | 0.81 s, best index | $0.80 | Released 2026-10-14 |
| Amazon Nova 2.5 Sonic | No | Through an async tool | No Japanese, no Chinese | 1.14 s | About $0.09 nominal | GA 2026-10-05 |
| Azure Voice Live with Claude | No, a cascade | Claude from Microsoft Foundry | Azure speech's | Not measured | Not measured | Claude mode in preview |
| ElevenLabs Agents | No, a cascade | Claude built in | Most | Not measured | $0.80 plus the model | GA |
| Deepgram Voice Agent | No, a cascade | Claude supported, or our own endpoint | No Chinese | Not measured | $0.65 plus the model | GA |
| Hume EVI | | Supported Claude | | | | Shuts down on 2026-11-13 |
| Ultravox, Moshi, PersonaPlex, Kyutai Unmute, Sesame | | No, or self-hosted research | No | | | Not production options for us |

### OpenAI GPT-Live-1

A full-duplex voice model released in the API on 2026-09-10, at its own endpoint,
`v1/live/sessions`, not the Realtime API's. It listens while it speaks, handles pauses,
interruptions and backchannels, and is designed to hand reasoning and tool use to a backend. In
"client delegation" (`delegation: { type: "client" }`, fixed for the session) that backend is ours,
whatever its model:

- When it decides work is needed, it emits `session.delegation.created`, carrying an id and no text.
  The backend rebuilds the request from the transcripts, `session.input_transcript.delta` for the
  member and `session.output_transcript.delta` for itself, fragments with approximate timings and no
  event marking a turn's end.
- The backend answers under that id with `session.commentary.append` (said aloud, paraphrased),
  `session.thinking.append` (quiet context it uses later) or `session.instructions.append` (trusted
  direction, which can interrupt its speech), at most 500 tokens each, as many as it needs, so an
  answer can stream sentence by sentence.
- Interrupting its speech does not stop the backend's work: cancelling is ours to do.
- **The server holds the key and the call.** The browser sends its WebRTC offer to our server,
  which creates the session with the API key and returns the answer; there is no ephemeral key.
  Audio goes over WebRTC, events over a data channel named `oai-events`. Our server can attach a
  sideband to the running session, `wss://api.openai.com/v1/live/sessions/{id}/attach`, which
  receives the transcripts, the delegations and the usage, and sends the appends and `session.close`.
  WebSocket and SIP transports exist too.
- Instructions up to 16384 tokens, a startup history of up to 128 messages and 8192 tokens (so a
  call can carry on a typed conversation), a 128000-token context it summarizes itself past 90%.
  No maximum duration is published, though an `expired` close reason exists. 12 voices, set at
  startup. Keyword biasing for its speech recognition.
- $0.05 a minute, billed per second, plus 15 seconds charged at creation and credited once the
  session runs; the backend's model is billed apart. 50 concurrent sessions on the Build tier, 300
  on Launch, none on Free. EU processing and zero data retention are available; with `store: true`
  recordings are kept 30 days.
- OpenAI reports turn-taking at 0.80 s against 1.41 s for gpt-realtime-2.1. Artificial Analysis
  ranks it first on conversational dynamics and on τ-Voice task completion when paired with an
  OpenAI backend.

What its first month's users report, on OpenAI's forum: a natural back and forth, good noise
handling; but accents that drift in French (only two voices free of an English accent) and in
British and Irish English; the voice sometimes answering without delegating, or speaking a preamble
before the delegation starts; no client event to cancel a response or clear the input; calls that a
spoken goodbye does not end; transcripts of the member's speech that one builder could not find
while another used the deltas. The voices are labelled English (ten) and Portuguese (two); OpenAI
publishes no language list.

### Google Gemini 3.8 Live

A native audio model, stable on the Gemini API since 2026-09-15 and generally available on Google
Cloud's Agent Platform (formerly Vertex AI) since 2026-09-24, in the `us` and `eu` multi-regions and
us-central1. It is turn-based with barge-in: voice activity detection decides the turn, and an
`interrupted` event tells the client to drop the audio it buffered.

- **Function calls do not block.** On 3.8 Live, `NON_BLOCKING` is the default: the model keeps
  talking and listening while the function runs, and the result comes back with a `scheduling` of
  `INTERRUPT` (say it now), `WHEN_IDLE` (after the current sentence) or `SILENT` (keep it for later).
  The Extended Thinking variant accepts nothing else. So an `ask_strategy_dance` function that our
  backend answers with Claude gives the same shape as GPT-Live's delegation. The model, not us,
  decides when to call it, and it speaks the result in its own words.
- 99 languages on the Gemini API's capabilities page, chosen automatically and restricted through
  instructions; 70 on the overview, 97 in the launch post, 24 on Google Cloud's page. All seven of
  ours are on the long list.
- **Sessions need plumbing.** An audio session lasts 15 minutes unless context compression is on; a
  connection lasts about 10 minutes and announces its end with `GoAway`; a resumption handle stays
  valid 2 hours. A call longer than ten minutes is several connections stitched together.
- **The browser connects with an ephemeral token** our backend mints, which can lock the model and
  its configuration (`liveConnectConstraints`), 30 minutes by default, on the Gemini Developer API
  only (preview). On Google Cloud, where the EU region is, the audio would go through our backend.
  The Developer API's paid tier does not train on prompts, logs them a limited time for abuse, may
  cache them in any country, and is the only tier allowed for users in the EEA.
- **The price is lower than it ends up.** Audio is $3 per million tokens in and $12 out, about
  $0.005 and $0.018 a minute, and text $0.75 and $4.50. But every turn bills the whole context again
  with no caching, and 3.8's proactive audio, always on, bills listening the whole time. Realistic
  estimates for ten minutes run from $0.40 to $0.80; the probe settles it from the usage it reports.
- Alone it reasons weakly (τ-Voice 30.1%, against 68.6% for its Extended Thinking sibling), which
  does not matter when Claude does the reasoning, and makes the right final tool call in 93% of an
  arena's conversations.
- In the browser, its audio arrives as PCM over a WebSocket and plays through Web Audio, which the
  browser's echo cancellation does not reliably cover (it covers WebRTC playback): without care the
  model hears itself and cuts itself off. Firebase AI Logic, which would add App Check, offers only
  the older 3.1 and 2.5 Live models.

### OpenAI gpt-realtime-2.1

The mature Realtime API (2.1 and 2.1-mini released 2026-07-06, the beta interface removed in May):
semantic voice activity detection with an eagerness setting, automatic truncation of what was not
heard over WebRTC, ephemeral client secrets for the browser, a server sideband, remote MCP servers,
and a 60-minute session. A function call is a turn of its own, hidden behind a spoken preamble.
Every turn re-bills the conversation, cached at best effort: about $0.45 per ten minutes when the
cache holds, over $1 when it misses; the mini about $0.16. It is the fallback within OpenAI if
GPT-Live's age shows, less natural by OpenAI's own turn-taking figure.

### A cascade keeping Claude

Speech to text, Claude, text to speech, each streamed. The best TypeScript assembly in 2026:

- **LiveKit Agents for Node.js** (1.9.3, 2026-10-15), with its Anthropic plugin, WebRTC through
  LiveKit Cloud. Its audio turn detector and its adaptive interruption handling (telling a real
  barge-in from "uh-huh") run free on LiveKit Cloud only. Nothing WebRTC can be hosted on Cloud Run,
  which accepts no inbound UDP: self-hosting means GKE or Compute Engine.
- **Deepgram Flux** for speech to text with end of turn built in (about 260 ms, the vendor's claim,
  and an early "probably done" event to start Claude speculatively), in English, French, German,
  Spanish, Italian, Portuguese and Japanese, without Chinese, which would go to AssemblyAI's or
  Soniox's multilingual models.
- **Claude Haiku 5.5** speaking each turn, with a short spoken prompt and a `delegate` tool to the
  full agent for real work.
- **Cartesia Sonic 3.6** for text to speech: 44 languages including ours, text streamed in, word
  timestamps that say exactly what was heard when the member cuts in.

About 1.0 to 1.5 seconds per turn at the median and 2 to 3 seconds at the 95th percentile, the tail
being Claude's first token; about $0.21 to $0.32 per ten minutes. Claude says every word, verbatim,
which is its strength. But it is half duplex, with no backchannels and interruptions decided by
heuristics, and Claude's first token sits on every turn, small talk included. Anthropic's own
cookbook is this design. It is the control group the probe measures the fronts against.

### The rest

- **xAI Grok Voice 3.0**, released the day before this was written: the best Artificial Analysis
  index (86.9) and 0.81 s to first audio, $0.08 a minute, the Realtime API's protocol, function
  calling and remote MCP, 20+ languages listed, ours among them. Too new, no data residency
  documented, and its brain is Grok's.
- **Amazon Nova 2.5 Sonic**: no Japanese and no Chinese, 8-minute connections, server-side only.
- **Azure Voice Live** can run Claude deployed in Microsoft Foundry, as a cascade, in preview.
- **ElevenLabs Agents** and **Deepgram Voice Agent** are hosted cascades with Claude supported, at
  $0.08 and $0.065 to $0.163 a minute before the model. They give up full duplex and add a platform
  between us and Claude.
- **Hume EVI**, which supported Claude, shuts down on 2026-11-13. **Ultravox** runs its own model
  and was acquired on 2026-10-01. **Moshi** and **NVIDIA PersonaPlex** are English-only research
  models with their own brains. **Kyutai Unmute** wraps any model but speaks English and French
  only, self-hosted on GPUs. **Sesame** offers text to speech only.

## The recommendation

### The architecture

```text
                         audio (WebRTC) + events
   Member's browser  ◀──────────────────────────────▶  Voice front (GPT-Live-1)
        │                                                   ▲         │
        │ start the call (WebRTC offer)                     │         │ transcripts, delegations,
        ▼                                                   │         │ usage (sideband)
   Voice service (Cloud Run) ── creates the session ────────┘         │
        │  ◀──────────────────────────────────────────────────────────┘
        │  a delegation becomes a voice run of the conversation:
        │  Claude Opus 5.5, the system prompt, Knowledge, Tasks, integrations, web search
        │  Claude's text, sentence by sentence ──▶ session.commentary.append
        ▼
   Data Connect: transcript entries, thread messages, the call's row and usage
```

- **The front owns the audio and the manners**: when the member is done, cutting in, backchannels,
  acknowledgments, greetings, clarifications, goodbyes. Its prompt says how to speak and when to
  delegate, and carries only what the agent already reads about the people: the organization's
  name and brief, the member's name, job title and bio. It never answers about the company itself.
- **Claude owns the substance**, as a run of the conversation the call belongs to, so a call and a
  typed exchange continue each other.
- **One provider seam in the backend**: starting a call, receiving a delegation, sending text back,
  closing, reading usage. GPT-Live is the first implementation; Gemini fits behind it (its
  delegations arrive through the browser, since it has no sideband), and so would Anthropic's own
  voice API should one come.

### The provider

1. **GPT-Live-1, if it passes the locales.** It is the only option that is truly full duplex and
   the only one designed for an agent of one's own behind it. Its server-held key and sideband give
   us what the rest of the backend expects: the backend decides, starts and ends the call, sees
   authoritative usage, and holds the delegations, without the browser in the middle. Its audio
   rides WebRTC, which the browser's echo cancellation covers. Its risks are its age, its
   paraphrasing, its English-and-Portuguese voices, and delegations it might skip.
2. **Gemini 3.8 Live otherwise.** All seven locales, generally available, cheapest at list price,
   and Google is already a processor (Cloud, and Gemini in the translations). It costs turn-taking
   quality (not full duplex), session plumbing, a browser that relays the function calls, a
   WebSocket audio path to make echo-safe, and EU residency only by proxying the audio.
3. **The tradeoff David asked to see.** If GPT-Live fails some locales, three ways: ship those
   locales later; route them to Gemini behind the same seam (one design, two integrations to keep);
   or take Gemini for everyone and give up full duplex.

Not the cascade: it is half duplex, puts Claude's first token on every turn, and needs a WebRTC
server we cannot run on Cloud Run. Not the rest, each for the reason given above.

## Latency

Where the time goes on a delegated turn, from the end of the member's question to the first word of
the answer, and on a small-talk turn. A figure is published unless marked "to measure"; the probe
measures them all. The voice service is in us-central1, as the backend is; a member in Europe adds
about 100 ms of round trip to whatever crosses the Atlantic.

| Segment | GPT-Live-1 + Claude | Gemini 3.8 Live + Claude | Cascade (Claude speaks) |
| --- | --- | --- | --- |
| End of the member's speech to the front deciding | Within its 0.80 s turn-taking | 500 to 800 ms of silence by default | About 260 ms (Flux), plus the turn detector's minimum delay |
| First audio back: small talk, or the acknowledgment of a delegated question | 0.80 s (OpenAI) to 1.24 to 1.34 s | 1.18 s | 1.0 to 1.5 s median, the whole answer |
| The delegation reaching our backend | Sideband, US to US, tens of ms; plus the transcript settling, to measure | Browser to backend and back, about 100 to 200 ms from Europe | In process |
| Our backend before Claude starts | About 0.6 to 1.5 s today, estimated from the code (eight Data Connect round trips, `countTokens`, the reservation), target under 0.3 s | Same | Same, on delegations only |
| Claude's first text | To measure. Opus 5.5 at medium effort with a warm cache; for scale, Sonnet 4.6 850 ms median and 4.1 s at p95, Haiku 4.5 637 ms and 1.6 s | Same | Same, on every turn |
| Claude's first sentence | 0.2 to 0.5 s more | Same | Same |
| The front saying it | To measure (it paraphrases) | To measure (it speaks the result) | 75 to 190 ms (Cartesia) |
| **First answer audio after the question** | **About 3 to 5 s**, with the acknowledgment at about 1 s | **About 3 to 5 s**, with the acknowledgment at about 1.2 s | **1.0 to 1.5 s** for simple answers, far more with tools, and no acknowledgment unless built |

Three levers matter most:

- **Claude's first token.** A voice turn keeps the conversation's model (switching to Haiku would
  miss the cache, which is per model, and drop Opus's thinking blocks, which no other model reads
  but Fable and Mythos), keeps the cache warm (writing it at the start of a call costs $0.15 to $0.50
  for a long conversation, worth it), and asks for a quick start ("Latency-sensitive; begin your
  visible answer immediately", from Anthropic's guidance for voice). Fast mode raises output speed,
  not the first token. Lowering effort for voice turns is a design question below.
- **Our own overhead.** Today a run reads and writes Data Connect about eight times and counts its
  tokens before Claude starts, about a second. A voice run has to get that under 0.3 s: fewer
  round trips, the measurement off the critical path, the module tools listed once per process.
- **The front's acknowledgment.** It is what makes three to five seconds feel like a person
  thinking. Both fronts do it from their prompt.

## Cost

For a call of ten minutes: the member speaking about four, Strategy Dance about four, some twenty
turns of which about eight are delegated to Claude.

| | Voice | Claude | Ten minutes | An hour |
| --- | --- | --- | --- | --- |
| GPT-Live-1 + Claude Opus 5.5 | $0.50 | $0.25 to $0.50 | **$0.75 to $1.00** | $4.50 to $6.00 |
| Gemini 3.8 Live + Claude Opus 5.5 | $0.40 to $0.80 (to measure) | $0.25 to $0.50 | **$0.65 to $1.30** | $4 to $8 |
| gpt-realtime-2.1 + Claude Opus 5.5 | $0.45 to $1.00 | $0.25 to $0.50 | **$0.70 to $1.50** | $4 to $9 |
| Cascade, Haiku 5.5 speaking, Opus 5.5 for delegations | $0.20 to $0.30 | $0.25 to $0.50 for delegations | **$0.45 to $0.80** | $2.70 to $4.80 |

- **Claude per delegation**: about $0.03 to $0.06 at Opus 5.5's prices with a warm cache, one or two
  requests of a few hundred output tokens, thinking included. A delegation after more than five
  minutes without one writes the conversation to the cache again (`conversations.md`, Cost): $0.15
  for 30000 tokens.
- **Against today**: a typed run costs about $0.15 (`conversations.md`, Cost), and a member running
  ten a day about $1.50. An hour of talk costs what three or four such days do.
- **Caps**: M35 caps runs at 100 a day per member. At eight to twenty delegations per ten minutes,
  one to two hours of talk would spend them, so voice needs its own caps, in minutes, per member and
  per organization, with a maximum call length. For scale, 30 minutes a day per member is $2.25 to
  $3.

## What would change in the codebase

Each item is a question for the build, with what the code enforces today. None is decided.

1. **Where a voice run executes.** Not through the queue: Cloud Tasks and the worker's cold start
   alone take seconds. The run executes in the process holding the call, during a request that stays
   open for the whole call, since Cloud Run throttles the CPU once a response is sent and that is
   why runs live on the worker today (`ARE_CONVERSATION_RUNS_IN_PROCESS` in `constants.ts`, and
   `enqueueRun.ts`, whose development path does not wait). Proposed: a third service from the same
   image, as the worker is (`SERVICE=voice`), public, with a 60-minute timeout, Cloud Run's maximum,
   which bounds a call; the browser holds a request open to it for the call's life, which also
   carries the call's state to the page, and its end closes the session, so no call outlives its
   page. `runConversation` takes voice limits through its `limits` option (say 90 seconds and six
   requests a run), and the lease and the page's reconcile finish a run whose process died, as they
   do today. This reverses two decisions in `conversations.md` (no token streaming to the browser;
   runs off the public backend), which a yes revisits there.
2. **Streaming Claude's text.** `createAnthropicClaudeClient.ts` keeps only the final message. A
   voice run needs an `onText` callback through `runConversation`, `requestConversationTurn` and
   `ClaudeClient.stream`, splitting sentences with `Intl.Segmenter`, since Chinese and Japanese put
   no spaces between words, and stripping what cannot be said: `doc:` and `task:` links (their
   titles stay), citations, Markdown.
3. **Spoken style and effort, without breaking the cache.** The system prompt and the tools are
   pinned by hash, and changing them costs every conversation its cache and its earlier reasoning
   once, so voice adds to them, never edits them. Each run already sends a context message, the only
   `system` message `checkTranscript.ts` allows, right after the member's entry; two in a row are
   refused, and the transcript stores only a role and content, so an `output_config` or a
   `clear_at` on a message would be lost on replay, which is a history edit. Two options:
   - the spoken-style instruction (short sentences, no lists or links, ask in prose rather than
     through `ask_user`, "latency-sensitive; begin your visible answer immediately") as an extra
     block of the voice run's own context message, effort left at medium. It fits today's rules.
   - effort lowered for voice turns through a per-message `output_config.effort` (beta), carried on
     the context message, which needs a stored column for message options, the beta on every request
     of the conversation, `countTokens` and the fallback models accepting it, and a return to medium
     for the next typed run. The probe says whether it is worth it.
4. **What the transcript records.** A voice run starts, like a send, from a `USER` entry, carrying
   as text what was said since Claude last spoke: the member's transcribed words, the front's own
   small talk, labelled, and, after a barge-in, what Strategy Dance had actually said before the
   member cut in. Claude's turns are stored as sent and never trimmed: an edited turn breaks
   preserved thinking (a 400 for accounts created from 2026-08-31). Two cases need care: a stop
   drops an unfinished turn whole (`requestConversationTurn.ts`), and `stripBeforeFallback.ts`
   removes the text a refused model wrote before its fallback took over, text the member may have
   heard; the next `USER` entry quotes what was said in both.
5. **Barge-in while Claude works.** Either stop the run at once, through its stop, with no stopped
   note drawn for a call, the member's new words starting the next run; or let it finish and answer
   both. Stopping is the recommendation: it is what a person does. Words delivered into a running
   run after its tool results, which Anthropic supports, are left for later:
   `StoreConversationToolResults` claims no message position, and Retry keeps member messages while
   cutting the entries after its anchor.
6. **The thread.** What was said appears in the conversation as messages, marked as spoken by a
   column on `ConversationMessage` rather than a new kind, since `MEMBER_TEXT` is written by the
   sends, kept by Retry and read by search and the previews. Every new mutation is named in the
   refreshes of `GetConversations`, `GetDockConversations`, `GetConversation` and
   `GetConversationRun`.
7. **The call itself.** A `VoiceSession` row: conversation, member, organization, provider, model,
   start, end, billed seconds or tokens, close reason. A voice run names it
   (`ConversationRun.voiceSessionId`) rather than a new `ConversationRunTrigger`, since the sends
   write `MESSAGE` and M33 appends `REPORTS` first. No lock of its own on the conversation:
   `activeRunId` already runs one run at a time, and a typed send during a call waits its turn like
   any other. The caps of Cost, beside M35's.
8. **Routes.** Start a call (the WebRTC offer exchanged for GPT-Live; an ephemeral token with its
   configuration locked for Gemini), the call's open request, and, for Gemini, a delegation route the
   browser calls, idempotent through a message id derived from the call's and the delegation's ids.
   All behind App Check, the ID token, the membership, a staff gate of their own until launch, and a
   rate limit per member. A streamed answer is an exception to the `ApiResponse` envelope, as the
   OAuth and MCP routes are, written down as one. One instance kept warm (`--min-instances 1`), since
   a cold start adds seconds to a call's first delegation.
9. **Questions and approvals by voice.** `ask_user` draws a question and ends the run waiting; by
   voice Claude is asked to ask in prose instead, and a question it draws anyway is read out and
   answered through the answer route. Integration calls that need approval stay in the thread for the
   first release; only those an administrator lets run without approval run from a call. Module
   writes run without approval today, by David's decision, and a misheard sentence could make one;
   whether a call confirms a write out loud first is his call (see Decisions).
10. **Infrastructure and legal.** A key for the provider in Secret Manager, read through
    `retrieveSecret` (`openai-api-key`, or `gemini-api-key`, or the Agent Platform through the
    service's own credentials); the provider named in the legal review as a processor of members'
    voice; recordings off (`store: false`, zero data retention where offered); where voice is
    processed for members in the EU; `Permissions-Policy: microphone=(self)` in `firebase.json` as
    hardening, since the page needs the microphone and nothing else does.

The web's part, left out here beyond what shapes the backend: the microphone with echo
cancellation, noise suppression and gain control; a WebRTC peer connection for GPT-Live, or an
AudioWorklet over the WebSocket for Gemini, made echo-safe; iOS Safari, which needs a tap to start
audio and drops the microphone in a background tab, tested on real devices.

## Risks

- **GPT-Live-1 is one month old.** Its behaviour, events and prices can change, and early users
  report rough edges. Mitigated by the seam and by gpt-realtime-2.1 or Gemini as fallbacks.
- **Paraphrase.** Both fronts say Claude's answer in their own words. A figure, a name or a title
  can come out wrong. The probe tests it; if it fails, Claude's text is shown in the thread as the
  reference, and the front is told to read figures and names as given.
- **A skipped delegation.** The front may answer a question about the company itself, from nothing.
  Its prompt forbids it and it knows nothing about the company beyond the profile; the probe
  measures how often it happens.
- **Misheard words become Claude's input**, and can become writes to tasks and documents, which a
  member can restore for a day.
- **Prompt injection.** What Claude reads, documents, the web, integrations, can carry text meant for
  a model, which then reaches the front as commentary. The front has no tools (GPT-Live) or one
  (Gemini, which injected text could make call again and again, bounded by the caps), so it adds no
  capability Claude does not already have.
- **Voice is personal data.** It reaches a new processor, and today the backend runs in us-central1
  and Claude in the workspace's default region. The legal review before launch covers it.
- **Limits reached faster.** A call adds entries quickly: the 2000-message cap, the 800000-token
  context, the daily runs.
- **Mobile.** Safari's audio constraints and background tabs; the call ends when the page does.
- **Cost runaway**: a call left open. Bounded by the maximum length, the minute caps, the call
  ending with its page, and the spend limits above them.
- **A refusal mid-call.** Claude's fallback can replace text the member already heard (see What
  would change, 4).

## Validating before building

If David says yes, the first milestone is a probe, `bun run probe:voice`, written like
`probe:claude`: it calls the real services, costs a few dollars a run, runs from a developer's
machine, never in CI, and prints what passed, what failed and what it found. It decides the provider
against the thresholds below.

**Claude alone, first**, since it is the cheapest and decides the most:

- Time to first text for a voice turn on the agent's real request (`buildConversationRequest`,
  `buildConversationTools` with the modules listed as `probeClaude.ts` lists them), Opus 5.5 at
  medium and at low effort, with and without the latency line, against Haiku 5.5, cold and warm
  cache, median and p95.
- Whether the API takes what option 3 of What would change needs: effort on the context message,
  `countTokens` with the beta, each fallback model, the cache still read once the beta is added, a
  return from low to medium effort.
- Pre-warming: `max_tokens: 0` refuses to stream, so it is a call of its own, with an explicit cache
  breakpoint on the last stored entry.

**Each front, then**, GPT-Live-1 over its WebSocket transport and Gemini 3.8 Live through
`@google/genai`, with Claude answering behind it, the module calls answered with canned results:

- Speech synthesized for each locale (Gemini's text to speech, 24 kHz, resampled to 16 kHz for
  Gemini), streamed in 20 ms frames against the clock, as both providers require, followed by low
  noise so their detection fires; the end of speech found by its level; a manual end-of-turn mode
  beside it, to tell detection time from model time. A recording a person made can replace the
  synthesized speech.
- Measured: the small-talk gap; on a delegated question, the time to the delegation, to the
  transcript settling (GPT-Live's delegation carries no text), to the acknowledgment, to Claude's
  first text and first sentence, to the first answer audio; barge-in, against a simulated playback
  clock, since audio over a WebSocket arrives faster than it plays; a backchannel ("mm-hm") that
  should not stop it; the delegation rate over about ten questions about the company and five of
  small talk; whether a figure and a name from a module's result come out right; the language of
  every transcript; the cost from each provider's usage (and whether Gemini re-bills its context on
  every turn, over a long session); the setup time. Each reply's audio is saved for a person to
  listen to.
- Our backend's own overhead, measured apart, against the emulators.
- Scope: the whole matrix in English, French and Chinese or Japanese, a one-run check in the other
  four. Gemini can run at once with the translations' key; OpenAI needs an API key, which the stack
  does not have.

**Thresholds, set before measuring**, which a front has to meet:

| Measure | Threshold |
| --- | --- |
| Small-talk gap | Under 800 ms at the median |
| Acknowledgment of a delegated question | Under 1.2 s |
| First answer audio after a delegated question | Under 4 s at the median |
| Stopping when the member cuts in | Under 300 ms |
| "Mm-hm" not stopping it | Every time |
| Delegation of questions about the company | Over 90% |
| Figures and names said as Claude gave them | Every time |
| Each locale | Understood correctly, and an accent a native listener accepts |

## Milestones after a yes

- **V0, the probe**: the measurements, and the provider chosen. One pull request.
- **V1, a spike**: a staff-only call in a real browser, Claude reading only, no writes, thrown away
  after. It shows what the probe cannot: echo, Safari, how it feels.
- **V2, voice in conversations**: the voice service and its routes, the voice run, streaming,
  transcript and thread, `VoiceSession`, behind a staff gate. Best after M33 to M35, which change
  the same runs, triggers and caps.
- **V3, hardening**: usage reconciled with the provider, the minute caps, the legal review, the EU
  question, retention.
- **V4, launch**, locale by locale as each passes.

## Decisions for David

1. **Go or no go** on voice, and when, relative to M30 to M37.
2. **The provider**: GPT-Live-1 first and Gemini 3.8 Live second, chosen by the probe, as
   recommended; or one of them now.
3. **The locales at launch**, and if GPT-Live fails some: ship them later, route them to Gemini, or
   take Gemini for all.
4. **Barge-in while Claude works**: stop the run (recommended) or let it finish.
5. **Writes by voice**: whether a call confirms a change to tasks or documents out loud before
   making it, and whether integration approvals can be given by voice later.
6. **Limits**: the longest call (30 minutes proposed) and the daily minutes per member and per
   organization.
7. **Data**: recordings off at the provider (recommended), and where voice is processed for members
   in the EU.
8. **An OpenAI API key** for the probe and, if chosen, for production.

## Sources

Read on 2026-10-15. Dates in brackets are publication or update dates where the source gives one.

Anthropic

- Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Release notes: https://platform.claude.com/docs/en/release-notes/overview
- OpenAI SDK compatibility (audio stripped): https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk
- Voice mode in Claude's apps: https://support.claude.com/en/articles/11101966-using-voice-mode-on-claude-mobile-apps
- Voice dictation in Claude Code: https://code.claude.com/docs/en/voice-dictation, and TechCrunch [2026-03-03]: https://techcrunch.com/2026/03/03/claude-code-rolls-out-a-voice-mode-capability/
- ElevenLabs as Claude's speech subprocessor: https://the-decoder.com/anthropics-claude-uses-elevenlabs-technology-for-speech-features-rather-than-an-in-house-model/
- Voice Platform job posting: https://jobs.accel.com/companies/anthropic/jobs/72947466-senior-staff-software-engineer-voice-platform
- Cookbook, low-latency voice with ElevenLabs and Claude [2025-11-24]: https://platform.claude.com/cookbook/third-party-elevenlabs-low-latency-stt-claude-tts
- Claude Haiku 5.5 [2026-10-07]: https://platform.claude.com/docs/en/models/haiku-5-5/overview, https://www.anthropic.com/claude-haiku-5-5
- Fast mode: https://platform.claude.com/docs/en/build-with-claude/fast-mode
- Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching, https://claude.com/blog/prompt-caching
- Preserved thinking: https://platform.claude.com/docs/en/build-with-claude/preserved-thinking

OpenAI

- Changelog: https://developers.openai.com/api/docs/changelog
- GPT-Live-1 model page: https://developers.openai.com/api/docs/models/gpt-live-1
- GPT-Live guides: https://developers.openai.com/api/docs/guides/live, delegation https://developers.openai.com/api/docs/guides/live-delegation, sessions https://developers.openai.com/api/docs/guides/live-conversations, prompting https://developers.openai.com/api/docs/guides/live-prompting, migration https://developers.openai.com/api/docs/guides/live-migration
- Transports: WebRTC https://developers.openai.com/api/docs/guides/voice-webrtc?api=live, WebSocket https://developers.openai.com/api/docs/guides/voice-websockets?api=live, sideband https://developers.openai.com/api/docs/guides/voice-server-controls?api=live
- Latency and cost: https://developers.openai.com/api/docs/guides/voice-latency-cost?api=live
- Voice agents overview: https://developers.openai.com/api/docs/guides/voice-agents
- GPT-Live-1 announcement and replies [2026-09-10]: https://community.openai.com/t/introducing-gpt-live-1-in-the-api/1396471
- gpt-realtime-2.1 [2026-07-06]: https://community.openai.com/t/new-realtime-models-on-the-api-gpt-realtime-2-1-and-gpt-realtime-2-1-mini/1385896, https://developers.openai.com/api/docs/models/gpt-realtime-2.1
- Realtime guides: https://developers.openai.com/api/docs/guides/realtime-conversations, https://developers.openai.com/api/docs/guides/realtime-vad, https://developers.openai.com/api/docs/guides/realtime-mcp, https://developers.openai.com/api/docs/guides/voice-prompting
- Pricing: https://developers.openai.com/api/docs/pricing
- Data controls: https://developers.openai.com/api/docs/guides/your-data
- LiveKit's GPT-Live plugin notes: https://docs.livekit.io/agents/models/realtime/plugins/gpt-live

Google

- Gemini 3.8 Live launch [2026-09-15]: https://blog.google/innovation-and-ai/technology/developers-tools/build-real-time-voice-applications-gemini-audio/
- Models: https://ai.google.dev/gemini-api/docs/models, https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Live API: overview https://ai.google.dev/gemini-api/docs/live-api, tools https://ai.google.dev/gemini-api/docs/live-tools, sessions https://ai.google.dev/gemini-api/docs/live-session, ephemeral tokens https://ai.google.dev/gemini-api/docs/ephemeral-tokens, capabilities https://ai.google.dev/gemini-api/docs/live-api/capabilities, best practices https://ai.google.dev/gemini-api/docs/live-api/best-practices
- Gemini API terms: https://ai.google.dev/gemini-api/terms
- Agent Platform: Gemini 3.8 Live https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-live, Live API https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api, data residency https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency
- The `eu` multi-region serving 3.8 Live, a user report: https://community.livekit.io/t/gemini-3-8-live-rejected-with-vertexai-true-in-livekit-plugins-google-although-vertex-ai-serves-it-eu-multi-region/2179
- The tool-call contract at GA: https://anthonywang.cc/writing/gemini-3-8-live-ga-async-tool-call-contract/
- Firebase AI Logic Live API [2026-10-13]: https://firebase.google.com/docs/ai-logic/live-api

Benchmarks

- Artificial Analysis, speech to speech: https://artificialanalysis.ai/speech-to-speech
- A reading of it [2026-10-09]: https://www.jahanzaib.ai/blog/gemini-3-8-live-voice-agent-benchmarks
- Daily's voice agent benchmark: https://github.com/kwindla/aiewf-eval, https://www.daily.co/blog/benchmarking-llms-for-voice-agent-use-cases/, https://voiceaiandvoiceagents.com/

The cascade

- LiveKit Agents for Node: https://github.com/livekit/agents-js/releases, Anthropic plugin https://docs.livekit.io/agents/models/llm/plugins/anthropic/, turn detector https://docs.livekit.io/agents/logic/turns/turn-detector/, adaptive interruption https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/, pricing https://livekit.com/pricing, self-hosting https://docs.livekit.io/transport/self-hosting/kubernetes/
- Deepgram: Flux https://developers.deepgram.com/docs/flux/quickstart, changelog https://developers.deepgram.com/changelog, pricing https://deepgram.com/pricing, Voice Agent models https://developers.deepgram.com/docs/voice-agent-llm-models
- Cartesia: models https://docs.cartesia.ai/build-with-cartesia/tts-models, WebSocket https://docs.cartesia.ai/api-reference/tts/websocket, pricing https://cartesia.ai/pricing
- Pipecat's Anthropic service: https://docs.pipecat.ai/server/services/llm/anthropic

The rest

- xAI Grok Voice 3.0 [2026-10-14]: https://x.ai/news/grok-voice-3, https://docs.x.ai/docs/guides/voice/agent
- Amazon Nova Sonic: https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html
- Azure Voice Live [2026-10-08]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live, https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-bring-your-own-model
- ElevenLabs Agents: https://elevenlabs.io/docs/agents-platform/customization/llm, https://elevenlabs.io/pricing/api
- Hume EVI shutdown [2026-10-02]: https://dev.hume.ai/changelog
- Ultravox: https://www.ultravox.ai/, acquisition [2026-10-01] https://www.geekwire.com/2026/seattle-voice-ai-startup-ultravox-formerly-known-as-fixie-acquired-by-inworld/
- Kyutai Unmute: https://kyutai.org/unmute/, https://github.com/kyutai-labs/unmute

Platform

- Cloud Run WebSockets: https://docs.cloud.google.com/run/docs/triggering/websockets, container contract https://docs.cloud.google.com/run/docs/container-contract
- WebRTC over WebSocket for voice: https://livekit.com/blog/why-webrtc-beats-websockets-for-voice-ai-agents
- Echo cancellation: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation, iOS Safari capture https://bugs.webkit.org/show_bug.cgi?id=311451
