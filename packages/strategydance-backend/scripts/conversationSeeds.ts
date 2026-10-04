/*
  The conversations of the design ("Strategy Dance Conversations" in Claude Design,
  `conversations-data.js`), as `seedConversations.ts` writes them: every kind of entry the thread
  draws, every state of a tool call and of a question, a run in flight, one waiting for an answer
  and one stopped.

  Adapted where the design shows what the plan does not have. Its tools are named after the agent's
  (`read_knowledge` for `get_document`, `update_knowledge` for `update_document`, and so on), the
  web search it drew as an integration is `web_search`, and its integrations are calls to
  `call_integration_tool`, which the integration milestones give their own columns. "Launch week
  plan" writes its tasks into the launch checklist, since tasks are going away. "Weekly review"
  starts with the member's message, since the agent starts no conversation. Attachments come with
  the milestone that stores them.

  Times are milliseconds before the seed runs, so the list reads as the design's does whenever it
  is seeded. A knowledge link names a document by its key, which the seed turns into the id it
  gives that document in the organization
*/

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type Aspect =
  | 'STRATEGY'
  | 'MARKETING'
  | 'SALES'
  | 'PRODUCT'
  | 'ENGINEERING'
  | 'DESIGN'
  | 'PEOPLE'
  | 'FINANCES'
  | 'LEGAL'

export type SeedDocumentKey =
  | 'twelveMonthPlan'
  | 'competitorNotes'
  | 'pricingOptions'
  | 'weeklyReviewTemplate'
  | 'risksAndAssumptions'
  | 'fundraisingNarrative'
  | 'launchChecklist'
  | 'contractorAgreement'
  | 'ninetyDayGoal'

export type SeedDocument = {
  key: SeedDocumentKey
  title: string
  aspects: Aspect[]
  // One paragraph each
  paragraphs: string[]
  ago: number
}

export type SeedEntry = { ago: number } & (
  | { kind: 'MEMBER_TEXT' | 'AGENT_TEXT'; text: string }
  | {
      kind: 'TOOL_CALL'
      toolName: string
      toolStatus: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
      toolInput: unknown
      toolOutput?: unknown
      toolDurationMs?: number
    }
  | {
      kind: 'QUESTION'
      questionPrompt: string
      questionOptions: string[]
      isMultipleChoice: boolean
      answer?: { selected: string[]; other?: string; ago: number } | { isSkipped: true; ago: number }
    }
  | { kind: 'ASPECTS'; aspects: Aspect[]; aspectsSetBy: 'MEMBER' | 'AGENT' }
  | { kind: 'NOTE'; noteKind: 'STOPPED' }
)

export type SeedRun = {
  trigger: 'MESSAGE' | 'ANSWER'
  status: 'RUNNING' | 'WAITING' | 'COMPLETED' | 'STOPPED' | 'CONTINUED'
  // The latest progress line of a run in flight
  step?: string
  ago: number
  entries: SeedEntry[]
}

export type SeedConversation = {
  key: string
  title: string
  aspects: Aspect[]
  aspectsSetBy: 'MEMBER' | 'AGENT'
  unreadCount: number
  // Its last activity
  updatedAgo: number
  runs: SeedRun[]
  // Entries outside any run, such as an aspects note the member wrote, after the runs
  after?: SeedEntry[]
}

export const SEED_DOCUMENTS: SeedDocument[] = [
  {
    key: 'twelveMonthPlan',
    title: '12-month plan',
    aspects: ['STRATEGY', 'FINANCES'],
    paragraphs: [
      'Q1: beta with 20 founders, weekly calls.',
      'Q2: public launch, pricing at 19 per month.',
      'Q3: first AI-executed tasks.',
      'Q4: 500 paying founders.',
    ],
    ago: 5 * DAY,
  },
  {
    key: 'competitorNotes',
    title: 'Competitor notes',
    aspects: ['STRATEGY', 'PRODUCT'],
    paragraphs: [
      'Most tools focus on one part of the job: tasks, notes or coaching. None of them tie the work back to the company as a whole.',
    ],
    ago: 26 * DAY,
  },
  {
    key: 'pricingOptions',
    title: 'Pricing options',
    aspects: ['STRATEGY', 'FINANCES', 'SALES'],
    paragraphs: [
      'Option A: flat 19 per month.',
      'Option B: free tier with 1 aspect, 29 per month for all aspects.',
      'Option C: usage-based on AI tasks.',
      'Leaning towards A for the beta.',
      'Decision, Oct 2: the beta starts at a flat 19 per month, using the monthly price already in Stripe.',
    ],
    ago: 27 * MINUTE,
  },
  {
    key: 'weeklyReviewTemplate',
    title: 'Weekly review template',
    aspects: ['STRATEGY', 'PEOPLE'],
    paragraphs: [
      'What shipped this week?',
      'What slipped, and why?',
      'One thing to stop doing.',
      'The priority for next week.',
    ],
    ago: 74 * DAY,
  },
  {
    key: 'risksAndAssumptions',
    title: 'Risks and assumptions',
    aspects: ['STRATEGY'],
    paragraphs: [
      'Founders will share enough context for the guidance to be useful.',
      'Weekly accountability is worth paying for.',
      'The aspect model maps to how founders think about their company.',
    ],
    ago: 120 * DAY,
  },
  {
    key: 'fundraisingNarrative',
    title: 'Fundraising narrative',
    aspects: ['STRATEGY', 'FINANCES'],
    paragraphs: ['Start with the founder problem, show the beta numbers, end with the path to AI-led companies.'],
    ago: 200 * DAY,
  },
  {
    key: 'launchChecklist',
    title: 'Launch checklist',
    aspects: ['MARKETING', 'PRODUCT'],
    paragraphs: [
      'Landing page copy final.',
      'Launch thread drafted.',
      '20 invites sent.',
      'Mon 12: finish the Product Hunt page.',
      'Mon 12: record the demo video.',
      'Wed 14: post the launch thread on X.',
      'Thu 15: post in the Solo Founders Slack.',
    ],
    ago: 2 * HOUR,
  },
  {
    key: 'contractorAgreement',
    title: 'Contractor agreement',
    aspects: ['LEGAL', 'PEOPLE'],
    paragraphs: [
      'Scope, payment terms, IP assignment, 30-day notice.',
      'Payment: 50% on signature, 50% when the final files are delivered.',
    ],
    ago: 3 * DAY + MINUTE,
  },
  {
    key: 'ninetyDayGoal',
    title: '90-day goal',
    aspects: ['STRATEGY'],
    paragraphs: [
      'Goal: 20 founders in the beta by December 31.',
      'Why: the 12-month plan starts with a beta of 20 founders and weekly calls.',
    ],
    ago: 4 * DAY + MINUTE,
  },
]

// The conversations, latest activity first, each a function of the ids the seed gave the documents
export function buildSeedConversations(documentIds: Record<SeedDocumentKey, string>): SeedConversation[] {
  const link = (key: SeedDocumentKey, title: string) => `[${title}](doc:${documentIds[key]})`

  return [
    {
      key: 'october-investor-update',
      title: 'October investor update',
      aspects: ['FINANCES', 'STRATEGY'],
      aspectsSetBy: 'AGENT',
      unreadCount: 0,
      updatedAgo: MINUTE,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'RUNNING',
          step: 'Drafting the update',
          ago: 2 * MINUTE,
          entries: [
            { ago: 2 * MINUTE, kind: 'MEMBER_TEXT', text: 'Draft this month’s investor update. Keep it short.' },
            {
              ago: MINUTE + 5 * SECOND,
              kind: 'TOOL_CALL',
              toolName: 'call_integration_tool',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                integration: 'Stripe',
                tool: 'list_subscriptions',
                arguments: { status: 'active', created: { gte: '2026-09-01' } },
              },
              toolOutput: { active: 14, new_this_month: 6, churned: 1, mrr_usd: 266 },
              toolDurationMs: 377,
            },
            {
              ago: MINUTE + 3 * SECOND,
              kind: 'TOOL_CALL',
              toolName: 'read_log',
              toolStatus: 'SUCCEEDED',
              toolInput: { from: '2026-09-01', to: '2026-10-02' },
              toolOutput: {
                entries: [
                  { date: '2026-09-29', author: 'You', text: 'Onboarding brief step is live.' },
                  { date: '2026-10-01', author: 'You', text: 'Export for build-in-public cards works.' },
                ],
              },
              toolDurationMs: 61,
            },
            {
              ago: MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'search_knowledge',
              toolStatus: 'RUNNING',
              toolInput: { query: 'investor update', aspects: ['FINANCES', 'STRATEGY'] },
            },
          ],
        },
      ],
    },
    {
      key: 'pitch-deck-review',
      title: 'Pitch deck review',
      aspects: ['STRATEGY', 'MARKETING', 'FINANCES'],
      aspectsSetBy: 'MEMBER',
      unreadCount: 0,
      updatedAgo: 12 * MINUTE,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'COMPLETED',
          ago: 16 * MINUTE,
          entries: [
            {
              ago: 16 * MINUTE,
              kind: 'MEMBER_TEXT',
              text: `Review my pitch deck against the ${link('fundraisingNarrative', 'Fundraising narrative')}. What’s missing?`,
            },
            { ago: 15 * MINUTE, kind: 'ASPECTS', aspects: ['STRATEGY', 'FINANCES'], aspectsSetBy: 'AGENT' },
            {
              ago: 14 * MINUTE + 3 * SECOND,
              kind: 'TOOL_CALL',
              toolName: 'read_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: { id: documentIds.fundraisingNarrative },
              toolOutput: {
                title: 'Fundraising narrative',
                aspects: ['STRATEGY', 'FINANCES'],
                blocks: [
                  {
                    markdown:
                      'Start with the founder problem, show the beta numbers, end with the path to AI-led companies.',
                  },
                ],
              },
              toolDurationMs: 34,
            },
            {
              ago: 14 * MINUTE + 2 * SECOND,
              kind: 'TOOL_CALL',
              toolName: 'search_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: { query: 'beta numbers risks', aspects: ['STRATEGY', 'FINANCES'], limit: 5 },
              toolOutput: {
                results: [
                  { id: documentIds.twelveMonthPlan, title: '12-month plan', excerpt: 'Q3: first AI-executed tasks.' },
                  {
                    id: documentIds.risksAndAssumptions,
                    title: 'Risks and assumptions',
                    excerpt: 'Founders will share enough context for the guidance to be useful.',
                  },
                ],
              },
              toolDurationMs: 151,
            },
            {
              ago: 14 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'call_integration_tool',
              toolStatus: 'FAILED',
              toolInput: { integration: 'Notion', tool: 'search', arguments: { query: 'investor list' } },
              toolOutput: { error: 'unauthorized', message: 'Access expired. Reconnect Notion to use it again.' },
              toolDurationMs: 212,
            },
            {
              ago: 13 * MINUTE,
              kind: 'AGENT_TEXT',
              text: [
                `Your ${link('fundraisingNarrative', 'Fundraising narrative')} has 3 parts. The deck covers the first one well and skips the last one.`,
                '| Part | In the deck | Gap |\n|---|---|---|\n| Founder problem | Slides 2 to 4 | None |\n| Beta numbers | Slide 7 | No retention yet |\n| Path to AI-led companies | Missing | Whole section |',
                'To close the gaps:',
                [
                  '1. Add week-4 retention next to the **14 active founders**.',
                  `2. Add 1 slide on the path to AI-led companies, based on Q3 of your ${link('twelveMonthPlan', '12-month plan')}.`,
                  `3. Name the 2 riskiest assumptions from ${link('risksAndAssumptions', 'Risks and assumptions')} and how the beta tests them.`,
                ].join('\n'),
                'I couldn’t open your investor list: **Notion needs to be reconnected**.',
              ].join('\n\n'),
            },
          ],
        },
      ],
      after: [
        { ago: 12 * MINUTE, kind: 'ASPECTS', aspects: ['STRATEGY', 'MARKETING', 'FINANCES'], aspectsSetBy: 'MEMBER' },
      ],
    },
    {
      key: 'beta-pricing',
      title: 'Beta pricing',
      aspects: ['FINANCES', 'SALES', 'STRATEGY'],
      aspectsSetBy: 'AGENT',
      unreadCount: 0,
      updatedAgo: 25 * MINUTE,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'CONTINUED',
          ago: 32 * MINUTE,
          entries: [
            {
              ago: 32 * MINUTE,
              kind: 'MEMBER_TEXT',
              text: 'I need to set a price for the beta before launch. Can you help me decide?',
            },
            {
              ago: 31 * MINUTE + 2 * SECOND,
              kind: 'TOOL_CALL',
              toolName: 'search_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: { query: 'pricing', aspects: ['FINANCES', 'SALES'], limit: 5 },
              toolOutput: {
                results: [
                  {
                    id: documentIds.pricingOptions,
                    title: 'Pricing options',
                    excerpt:
                      'Option A: flat 19 per month. Option B: free tier with 1 aspect, 29 per month for all aspects. Option C: usage-based on AI tasks.',
                  },
                  {
                    id: documentIds.twelveMonthPlan,
                    title: '12-month plan',
                    excerpt: 'Q2: public launch, pricing at 19 per month.',
                  },
                ],
              },
              toolDurationMs: 184,
            },
            {
              ago: 31 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'call_integration_tool',
              toolStatus: 'SUCCEEDED',
              toolInput: { integration: 'Stripe', tool: 'list_prices', arguments: { active: true, limit: 10 } },
              toolOutput: {
                object: 'list',
                data: [
                  {
                    id: 'price_1QpX8kLb2Rv9',
                    nickname: 'Founder monthly',
                    unit_amount: 1900,
                    currency: 'usd',
                    recurring: { interval: 'month' },
                  },
                  {
                    id: 'price_1QpX9tLb2Rv9',
                    nickname: 'Founder yearly',
                    unit_amount: 19000,
                    currency: 'usd',
                    recurring: { interval: 'year' },
                  },
                ],
                has_more: false,
              },
              toolDurationMs: 412,
            },
            {
              ago: 30 * MINUTE,
              kind: 'AGENT_TEXT',
              text: `You already have 2 prices in Stripe: **19 per month** and **190 per year**. Your ${link('pricingOptions', 'Pricing options')} note lists 3 models:\n\n- Flat 19 per month\n- Free tier with 1 aspect, then 29 per month\n- Usage-based on AI tasks`,
            },
            {
              ago: 30 * MINUTE,
              kind: 'QUESTION',
              questionPrompt: 'Which model should the beta start with?',
              questionOptions: [
                'Flat 19 per month',
                'Free tier, then 29 per month',
                'Usage-based on AI tasks',
                'Free for the whole beta',
              ],
              isMultipleChoice: false,
              answer: { selected: ['Flat 19 per month'], ago: 28 * MINUTE },
            },
          ],
        },
        {
          trigger: 'ANSWER',
          status: 'WAITING',
          ago: 28 * MINUTE,
          entries: [
            {
              ago: 27 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'update_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                id: documentIds.pricingOptions,
                append:
                  'Decision, Oct 2: the beta starts at a flat 19 per month, using the monthly price already in Stripe.',
              },
              toolOutput: { id: documentIds.pricingOptions, title: 'Pricing options' },
              toolDurationMs: 88,
            },
            {
              ago: 26 * MINUTE,
              kind: 'AGENT_TEXT',
              text: `Flat 19 per month it is. It matches the monthly price already in Stripe, so nothing needs to change before launch. I wrote the decision in ${link('pricingOptions', 'Pricing options')}.`,
            },
            {
              ago: 25 * MINUTE,
              kind: 'QUESTION',
              questionPrompt: 'Who should keep the beta price after launch?',
              questionOptions: [
                'The first 20 founders',
                'Everyone on the waitlist',
                'Founders who join a weekly call',
                'People referred by a current user',
              ],
              isMultipleChoice: true,
            },
          ],
        },
      ],
    },
    {
      key: 'launch-week-plan',
      title: 'Launch week plan',
      aspects: ['MARKETING', 'PRODUCT'],
      aspectsSetBy: 'AGENT',
      unreadCount: 1,
      updatedAgo: 2 * HOUR,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'CONTINUED',
          ago: 2 * HOUR + 15 * MINUTE,
          entries: [
            {
              ago: 2 * HOUR + 15 * MINUTE,
              kind: 'MEMBER_TEXT',
              text: 'Launch is on October 14. What should that week look like?',
            },
            {
              ago: 2 * HOUR + 12 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'call_integration_tool',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                integration: 'Google Calendar',
                tool: 'list_events',
                arguments: {
                  calendarId: 'primary',
                  timeMin: '2026-10-12T00:00:00Z',
                  timeMax: '2026-10-18T23:59:59Z',
                },
              },
              toolOutput: {
                items: [
                  {
                    summary: 'Investor call, Northwind Ventures',
                    start: '2026-10-13T15:00:00-04:00',
                    end: '2026-10-13T15:45:00-04:00',
                  },
                  { summary: 'Weekly review', start: '2026-10-16T09:00:00-04:00', end: '2026-10-16T09:30:00-04:00' },
                ],
              },
              toolDurationMs: 538,
            },
            {
              ago: 2 * HOUR + 11 * MINUTE,
              kind: 'AGENT_TEXT',
              text: 'Your calendar is mostly free that week. 2 things are booked: an investor call on Tuesday at 3 pm and your weekly review on Friday morning.',
            },
            {
              ago: 2 * HOUR + 11 * MINUTE,
              kind: 'QUESTION',
              questionPrompt: 'Where will you announce the launch?',
              questionOptions: ['X', 'LinkedIn', 'Product Hunt', 'Indie Hackers'],
              isMultipleChoice: true,
              answer: { selected: ['X', 'Product Hunt'], other: 'The Solo Founders Slack', ago: 2 * HOUR + 8 * MINUTE },
            },
          ],
        },
        {
          trigger: 'ANSWER',
          status: 'COMPLETED',
          ago: 2 * HOUR + 8 * MINUTE,
          entries: [
            {
              ago: 2 * HOUR + 7 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'update_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                id: documentIds.launchChecklist,
                append:
                  'Mon 12: finish the Product Hunt page.\n\nTue 13: record the demo video.\n\nWed 14: post the launch thread on X.\n\nThu 15: post in the Solo Founders Slack.',
              },
              toolOutput: { id: documentIds.launchChecklist, title: 'Launch checklist' },
              toolDurationMs: 96,
            },
            {
              ago: 2 * HOUR + 6 * MINUTE,
              kind: 'AGENT_TEXT',
              text: `I added the week to your ${link('launchChecklist', 'Launch checklist')}:\n\n1. Mon 12: finish the Product Hunt page\n2. Tue 13: record the demo video\n3. Wed 14: post the launch thread on X\n4. Thu 15: post in the Solo Founders Slack\n\nThe page copy can come straight from the checklist.`,
            },
          ],
        },
        {
          trigger: 'MESSAGE',
          status: 'COMPLETED',
          ago: 2 * HOUR + 2 * MINUTE,
          entries: [
            {
              ago: 2 * HOUR + 2 * MINUTE,
              kind: 'MEMBER_TEXT',
              text: 'Move the demo video to Monday. Tuesday is busy with the investor call.',
            },
            {
              ago: 2 * HOUR + MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'update_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                id: documentIds.launchChecklist,
                replaceText: { find: 'Tue 13: record the demo video', replace: 'Mon 12: record the demo video' },
              },
              toolOutput: { id: documentIds.launchChecklist, title: 'Launch checklist' },
              toolDurationMs: 71,
            },
            {
              ago: 2 * HOUR,
              kind: 'AGENT_TEXT',
              text: 'Done. The demo video is now due **Monday the 12th**, with the Product Hunt page.',
            },
          ],
        },
      ],
    },
    {
      key: 'weekly-review',
      title: 'Weekly review',
      aspects: ['STRATEGY', 'PEOPLE'],
      aspectsSetBy: 'AGENT',
      unreadCount: 0,
      updatedAgo: 5 * HOUR,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'CONTINUED',
          ago: 5 * HOUR + 25 * MINUTE,
          entries: [
            { ago: 5 * HOUR + 25 * MINUTE, kind: 'MEMBER_TEXT', text: 'Time for my weekly review.' },
            {
              ago: 5 * HOUR + 24 * MINUTE,
              kind: 'AGENT_TEXT',
              text: 'Let’s do it. I’ll pull what you closed in Linear and what you wrote in your log.',
            },
            {
              ago: 5 * HOUR + 20 * MINUTE + 2 * SECOND,
              kind: 'TOOL_CALL',
              toolName: 'call_integration_tool',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                integration: 'Linear',
                tool: 'list_issues',
                arguments: { assignee: 'me', state: 'Done', completedAfter: '2026-09-28' },
              },
              toolOutput: {
                nodes: [
                  { identifier: 'SD-41', title: 'Onboarding: brief step', completedAt: '2026-09-29' },
                  { identifier: 'SD-44', title: 'Fix streak timezone bug', completedAt: '2026-09-30' },
                  { identifier: 'SD-47', title: 'Build in public: export cards', completedAt: '2026-10-01' },
                ],
              },
              toolDurationMs: 655,
            },
            {
              ago: 5 * HOUR + 20 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'read_log',
              toolStatus: 'SUCCEEDED',
              toolInput: { from: '2026-09-28', to: '2026-10-02' },
              toolOutput: {
                entries: [
                  { date: '2026-10-01', author: 'You', text: 'Export for build-in-public cards works.' },
                  { date: '2026-09-30', author: 'You', text: 'Rewrote the pricing copy again.' },
                  { date: '2026-09-29', author: 'You', text: 'Onboarding brief step is live.' },
                  { date: '2026-09-28', author: 'You', text: 'Top priority this week: ship the pricing page.' },
                ],
              },
              toolDurationMs: 58,
            },
            {
              ago: 5 * HOUR + 19 * MINUTE,
              kind: 'AGENT_TEXT',
              text: `You closed 3 issues and wrote 4 log updates. The pricing page was your priority on Monday and is still open. I used your ${link('weeklyReviewTemplate', 'Weekly review template')} for the questions below.`,
            },
            {
              ago: 5 * HOUR + 19 * MINUTE,
              kind: 'QUESTION',
              questionPrompt: 'What got in the way of the pricing page?',
              questionOptions: [
                'Not enough time',
                'Waiting on someone else',
                'Unsure about the price',
                'Other work came first',
              ],
              isMultipleChoice: false,
              answer: {
                selected: [],
                other: 'I kept rewriting the copy instead of shipping it',
                ago: 5 * HOUR + 10 * MINUTE,
              },
            },
          ],
        },
        {
          trigger: 'ANSWER',
          status: 'CONTINUED',
          ago: 5 * HOUR + 10 * MINUTE,
          entries: [
            {
              ago: 5 * HOUR + 9 * MINUTE,
              kind: 'AGENT_TEXT',
              text: 'Set a limit for next week: **one draft by Monday noon**, published as is. You can edit it after launch.',
            },
            {
              ago: 5 * HOUR + 9 * MINUTE,
              kind: 'QUESTION',
              questionPrompt: 'How much time will you give the pricing page on Monday?',
              questionOptions: ['1 hour', '2 hours', 'Half a day', 'The whole day'],
              isMultipleChoice: false,
              answer: { isSkipped: true, ago: 5 * HOUR + 2 * MINUTE },
            },
          ],
        },
        {
          trigger: 'MESSAGE',
          status: 'COMPLETED',
          ago: 5 * HOUR + 2 * MINUTE,
          entries: [
            { ago: 5 * HOUR + 2 * MINUTE, kind: 'MEMBER_TEXT', text: 'OK. Make that my priority for Monday.' },
            {
              ago: 5 * HOUR + MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'set_top_priority',
              toolStatus: 'SUCCEEDED',
              toolInput: { text: 'Publish the pricing page, one draft, as is' },
              toolOutput: { topPriority: 'Publish the pricing page, one draft, as is' },
              toolDurationMs: 44,
            },
            {
              ago: 5 * HOUR,
              kind: 'AGENT_TEXT',
              text: 'Done. Your top priority is now: publish the pricing page, one draft, as is.',
            },
          ],
        },
      ],
    },
    {
      key: 'competitor-prices',
      title: 'Competitor prices',
      aspects: ['STRATEGY', 'SALES'],
      aspectsSetBy: 'AGENT',
      unreadCount: 0,
      updatedAgo: 2 * DAY + 5 * MINUTE,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'COMPLETED',
          ago: 2 * DAY + 10 * MINUTE,
          entries: [
            { ago: 2 * DAY + 10 * MINUTE, kind: 'MEMBER_TEXT', text: 'What are competitors charging right now?' },
            {
              ago: 2 * DAY + 9 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'web_search',
              toolStatus: 'FAILED',
              toolInput: { query: 'founder coaching app pricing 2026' },
              toolOutput: { error: 'timeout', message: 'The request took longer than 30 s and was cancelled.' },
              toolDurationMs: 30000,
            },
            {
              ago: 2 * DAY + 8 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'read_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: { id: documentIds.competitorNotes },
              toolOutput: {
                title: 'Competitor notes',
                aspects: ['STRATEGY', 'PRODUCT'],
                blocks: [
                  {
                    markdown:
                      'Most tools focus on one part of the job: tasks, notes or coaching. None of them tie the work back to the company as a whole.',
                  },
                ],
              },
              toolDurationMs: 29,
            },
            {
              ago: 2 * DAY + 7 * MINUTE,
              kind: 'AGENT_TEXT',
              text: `The web search timed out, so I couldn’t check live prices. Your ${link('competitorNotes', 'Competitor notes')} don’t list prices either. They say most tools cover one part of the job: tasks, notes or coaching.`,
            },
          ],
        },
        {
          trigger: 'MESSAGE',
          status: 'STOPPED',
          ago: 2 * DAY + 6 * MINUTE,
          entries: [
            {
              ago: 2 * DAY + 6 * MINUTE,
              kind: 'MEMBER_TEXT',
              text: 'Try again and also check their changelogs.',
            },
            {
              ago: 2 * DAY + 5 * MINUTE + 10 * SECOND,
              kind: 'TOOL_CALL',
              toolName: 'web_search',
              toolStatus: 'CANCELLED',
              toolInput: { query: 'founder coaching app changelog' },
            },
            { ago: 2 * DAY + 5 * MINUTE, kind: 'NOTE', noteKind: 'STOPPED' },
          ],
        },
      ],
    },
    {
      key: 'contractor-agreement',
      title: 'Contractor agreement',
      aspects: ['LEGAL', 'PEOPLE'],
      aspectsSetBy: 'AGENT',
      unreadCount: 0,
      updatedAgo: 3 * DAY,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'CONTINUED',
          ago: 3 * DAY + 8 * MINUTE,
          entries: [
            {
              ago: 3 * DAY + 8 * MINUTE,
              kind: 'MEMBER_TEXT',
              text: 'I’m hiring a freelance designer for 6 weeks. What should the contract cover?',
            },
            {
              ago: 3 * DAY + 6 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'read_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: { id: documentIds.contractorAgreement },
              toolOutput: {
                title: 'Contractor agreement',
                aspects: ['LEGAL', 'PEOPLE'],
                blocks: [{ markdown: 'Scope, payment terms, IP assignment, 30-day notice.' }],
              },
              toolDurationMs: 32,
            },
            {
              ago: 3 * DAY + 5 * MINUTE,
              kind: 'AGENT_TEXT',
              text: `Your ${link('contractorAgreement', 'Contractor agreement')} note covers scope, payment terms, IP assignment and a 30-day notice. For a 6-week project, add:\n\n- A list of deliverables with dates\n- Who owns drafts and source files\n- How many rounds of revisions are included\n\n**Have a lawyer review the final version before you sign.**`,
            },
            {
              ago: 3 * DAY + 5 * MINUTE,
              kind: 'QUESTION',
              questionPrompt: 'How will you pay the designer?',
              questionOptions: [
                'Fixed price for the project',
                'Weekly rate',
                'Hourly, with a cap',
                'Half up front, half on delivery',
              ],
              isMultipleChoice: false,
              answer: { selected: ['Half up front, half on delivery'], ago: 3 * DAY + 2 * MINUTE },
            },
          ],
        },
        {
          trigger: 'ANSWER',
          status: 'COMPLETED',
          ago: 3 * DAY + 2 * MINUTE,
          entries: [
            {
              ago: 3 * DAY + MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'update_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                id: documentIds.contractorAgreement,
                append: 'Payment: 50% on signature, 50% when the final files are delivered.',
              },
              toolOutput: { id: documentIds.contractorAgreement, title: 'Contractor agreement' },
              toolDurationMs: 76,
            },
            {
              ago: 3 * DAY,
              kind: 'AGENT_TEXT',
              text: `I added the payment terms to your ${link('contractorAgreement', 'Contractor agreement')}: 50% on signature, 50% when the final files are delivered.`,
            },
          ],
        },
      ],
    },
    {
      key: 'ninety-day-goal',
      title: '90-day goal',
      aspects: ['STRATEGY'],
      aspectsSetBy: 'AGENT',
      unreadCount: 0,
      updatedAgo: 4 * DAY,
      runs: [
        {
          trigger: 'MESSAGE',
          status: 'CONTINUED',
          ago: 4 * DAY + 7 * MINUTE,
          entries: [
            { ago: 4 * DAY + 7 * MINUTE, kind: 'MEMBER_TEXT', text: 'What should my goal be for the next 90 days?' },
            {
              ago: 4 * DAY + 5 * MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'search_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: { query: 'plan goals', aspects: ['STRATEGY'] },
              toolOutput: {
                results: [
                  {
                    id: documentIds.twelveMonthPlan,
                    title: '12-month plan',
                    excerpt: 'Q1: beta with 20 founders, weekly calls. Q2: public launch, pricing at 19 per month.',
                  },
                ],
              },
              toolDurationMs: 162,
            },
            {
              ago: 4 * DAY + 4 * MINUTE,
              kind: 'AGENT_TEXT',
              text: `Your ${link('twelveMonthPlan', '12-month plan')} starts with a beta of 20 founders and weekly calls. A 90-day goal should get you there.`,
            },
            {
              ago: 4 * DAY + 4 * MINUTE,
              kind: 'QUESTION',
              questionPrompt: 'Which goal fits best?',
              questionOptions: [
                '20 founders in the beta',
                '10 paying founders',
                '1 weekly call with every user',
                'A public launch date',
              ],
              isMultipleChoice: false,
              answer: { selected: ['20 founders in the beta'], ago: 4 * DAY + 2 * MINUTE },
            },
          ],
        },
        {
          trigger: 'ANSWER',
          status: 'COMPLETED',
          ago: 4 * DAY + 2 * MINUTE,
          entries: [
            {
              ago: 4 * DAY + MINUTE,
              kind: 'TOOL_CALL',
              toolName: 'create_knowledge',
              toolStatus: 'SUCCEEDED',
              toolInput: {
                title: '90-day goal',
                aspects: ['STRATEGY'],
                content: 'Goal: 20 founders in the beta by December 31.',
              },
              toolOutput: { id: documentIds.ninetyDayGoal, title: '90-day goal' },
              toolDurationMs: 94,
            },
            {
              ago: 4 * DAY,
              kind: 'AGENT_TEXT',
              text: `20 founders in the beta by the end of December. I saved it as ${link('ninetyDayGoal', '90-day goal')}.`,
            },
          ],
        },
      ],
    },
  ]
}
