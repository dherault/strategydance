// Replies from the conversations design, as the agent writes them, shared by the stories
const markdownSampleReplies = [
  'Here is a draft. It follows your [Fundraising narrative](doc:d7) and uses the Stripe numbers and your log.\n\n**October update**\n\n1. **Revenue:** 266 MRR from 14 active founders. 6 joined this month, 1 left.\n2. **Product:** the onboarding brief step is live, and build-in-public cards can be exported.\n3. **Next:** public launch on October 14.\n\nTell me what to cut before you send it.',
  'Your [Fundraising narrative](doc:d7) has 3 parts. The deck covers the first one well and skips the last one.\n\n| Part | In the deck | Gap |\n|---|---|---|\n| Founder problem | Slides 2 to 4 | None |\n| Beta numbers | Slide 7 | No retention yet |\n| Path to AI-led companies | Missing | Whole section |\n\nTo close the gaps:\n\n1. Add week-4 retention next to the **14 active founders**.\n2. Add 1 slide on the path to AI-led companies, based on Q3 of your [12-month plan](doc:d2).\n3. Name the 2 riskiest assumptions from [Risks and assumptions](doc:d6) and how the beta tests them.\n\nI couldn’t open your investor list: **Notion needs to be reconnected**.',
  'You already have 2 prices in Stripe: **19 per month** and **190 per year**. Your [Pricing options](doc:d4) note lists 3 models:\n\n- Flat 19 per month\n- Free tier with 1 aspect, then 29 per month\n- Usage-based on AI tasks',
  'I found changelogs for 3 tools. Their latest changes:\n\n| Tool | Latest change | Price shown |\n|---|---|---|\n| Coachly | Weekly goals | 24 per month |\n| Foundr OS | AI task lists | 15 per month |\n| Stackwise | Team plans | Not listed |\n\nNone of them tie the work back to the company as a whole, which matches your [Competitor notes](doc:d3). Sources: [Coachly](https://coachly.example/changelog), [Foundr OS](https://foundros.example/updates), [Stackwise](https://stackwise.example/releases).',
  'Your [Contractor agreement](doc:d12) note covers scope, payment terms, IP assignment and a 30-day notice. For a 6-week project, add:\n\n- A list of deliverables with dates\n- Who owns drafts and source files\n- How many rounds of revisions are included\n\n**Have a lawyer review the final version before you sign.**',
]

// The knowledge the replies link to, by id. "Risks and assumptions", `d6`, has been deleted
const markdownSampleDocuments = new Map([
  ['d2', '12-month plan'],
  ['d3', 'Competitor notes'],
  ['d4', 'Pricing options'],
  ['d7', 'Fundraising narrative'],
  ['d12', 'Contractor agreement'],
])

export { markdownSampleDocuments, markdownSampleReplies }
