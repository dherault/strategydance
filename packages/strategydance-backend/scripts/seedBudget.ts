import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'

import { addCalendarDays, addCalendarMonths, type BillRecurrence, type Currency } from 'strategydance-core'

import { dataConnect } from '~firebase'

/*
  Fills an organization's Budget page in the emulators with the Claude Design prototype's seed, and
  nowhere else:

    bun run seed:budget <email> [--organization <id or slug>]

  It sets a $2,500 monthly budget and writes the prototype's 19 bills, recurring and not, in dollars
  and euros, dated around today as the prototype dates them, into the organization named, or the
  only one the account belongs to. Their payers are the organization's members in turn. Each bill's
  id is derived from the organization and the bill, so running it again moves the same bills to the
  new today rather than adding 19 more, and brings back any of them deleted meanwhile. The page
  converts them with the rates `bun run sync:exchange-rates` writes.

  The rows are written as GraphQL through the Admin SDK, as `grantAdministrator.ts` writes its own,
  so nothing that seeds is ever deployed, and it refuses to run unless it points at the emulator,
  which the package's `seed:budget` script does
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run seed:budget <email>`',
  )
  process.exit(1)
}

const USAGE = 'Usage: bun run seed:budget <email> [--organization <id or slug>]'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: { organization: { type: 'string' } },
  allowPositionals: true,
})
// Firebase lowercases the addresses it stores, which are the ones the rows mirror
const email = positionals[0]?.trim().toLowerCase()

if (!email || positionals.length > 1) {
  console.error(USAGE)
  process.exit(1)
}

// The prototype's people, each paying their bills, in the order they first appear
type Payer = 'alex' | 'priya' | 'jordan' | 'lea' | 'sam'

const PAYERS: Payer[] = ['alex', 'priya', 'jordan', 'lea', 'sam']

type SeedBill = {
  key: string
  payer: Payer
  name: string
  description: string
  company: string
  amountMinor: number
  currency: Currency
  paidOn: string
  recurrence: BillRecurrence | null
}

// This machine's date, as the page reads the browser's
function readLocalToday() {
  const now = new Date()

  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(part => String(part).padStart(2, '0')).join('-')
}

// The prototype's `bgSeedBills`, in minor units, dated from today as it dates them
function buildSeedBills(today: string): SeedBill[] {
  const year = Number(today.slice(0, 4))
  // A day of the month `months` before this one, every day used being one each month has
  const monthsAgo = (months: number, day: number) =>
    `${addCalendarMonths(today, -months).slice(0, 8)}${String(day).padStart(2, '0')}`
  const daysAgo = (days: number) => addCalendarDays(today, -days)
  const bill = (
    key: string,
    payer: Payer,
    name: string,
    description: string,
    company: string,
    amountMinor: number,
    currency: Currency,
    paidOn: string,
    recurrence: BillRecurrence | null = null,
  ) => ({ key, payer, name, description, company, amountMinor, currency, paidOn, recurrence })

  return [
    bill(
      'b1',
      'alex',
      'Claude Team plan',
      '5 seats for the team',
      'Anthropic',
      15000,
      'USD',
      monthsAgo(10, 3),
      'MONTHLY',
    ),
    bill(
      'b2',
      'priya',
      'Cloud hosting',
      'Production and staging',
      'Amazon Web Services',
      31240,
      'USD',
      monthsAgo(8, 1),
      'MONTHLY',
    ),
    bill('b3', 'priya', 'Vercel Pro', 'Frontend hosting', 'Vercel', 2000, 'USD', monthsAgo(14, 12), 'MONTHLY'),
    bill(
      'b4',
      'alex',
      'Google Workspace',
      '3 Business Standard seats',
      'Google',
      4200,
      'USD',
      monthsAgo(20, 5),
      'MONTHLY',
    ),
    bill('b5', 'jordan', 'Figma Professional', '2 editors', 'Figma', 3000, 'USD', monthsAgo(9, 21), 'MONTHLY'),
    bill(
      'b6',
      'lea',
      'Design retainer',
      'Brand and product design, 10 days a month',
      'Léa Dubois Studio',
      120000,
      'EUR',
      monthsAgo(6, 28),
      'MONTHLY',
    ),
    bill(
      'b7',
      'alex',
      'Coworking desk',
      'Fixed desk, Paris 11e',
      'Morning Coworking',
      34000,
      'EUR',
      monthsAgo(12, 1),
      'MONTHLY',
    ),
    bill(
      'b8',
      'alex',
      'Accounting',
      'Quarterly bookkeeping and VAT filing',
      'Fiducial Expertise',
      90000,
      'EUR',
      `${year}-01-15`,
      'QUARTERLY',
    ),
    bill(
      'b9',
      'alex',
      'Apple Developer Program',
      'Annual membership',
      'Apple',
      9900,
      'USD',
      `${year - 1}-03-02`,
      'YEARLY',
    ),
    bill(
      'b10',
      'sam',
      'Domain renewal',
      'strategydance.com, 1 year',
      'Namecheap',
      1498,
      'USD',
      `${year - 2}-11-08`,
      'YEARLY',
    ),
    bill(
      'b11',
      'alex',
      'Liability insurance',
      'Professional liability, annual premium',
      'Hiscox',
      48000,
      'EUR',
      `${year - 1}-12-10`,
      'YEARLY',
    ),
    bill(
      'b12',
      'sam',
      'Newsletter',
      'Scale plan, up to 5,000 subscribers',
      'Beehiiv',
      4900,
      'USD',
      monthsAgo(4, 9),
      'MONTHLY',
    ),
    bill('b13', 'sam', 'Launch ads', 'Product Hunt launch week promotion', 'X', 40000, 'USD', daysAgo(13)),
    bill('b14', 'jordan', 'User interviews', '6 participant incentives', 'Respondent', 36000, 'USD', daysAgo(4)),
    bill('b15', 'sam', 'Sponsored posts', 'LinkedIn campaign for the beta', 'LinkedIn', 30000, 'USD', daysAgo(25)),
    bill('b16', 'alex', 'Conference ticket', 'Founders day', 'Station F', 25000, 'EUR', daysAgo(40)),
    bill('b17', 'jordan', 'Stock photos', '10 image pack for the landing page', 'Unsplash', 9600, 'USD', daysAgo(75)),
    bill('b18', 'priya', 'MacBook Air', '13-inch for development', 'Apple', 149900, 'USD', daysAgo(120)),
    bill(
      'b19',
      'alex',
      'Contract review',
      'Contractor agreement review',
      'Captain Contrat',
      39000,
      'EUR',
      daysAgo(200),
    ),
  ]
}

// The same id for the same bill of the same organization at every run, dashless as the emulator
// writes a UUID back
function deriveBillId(organizationId: string, key: string) {
  return createHash('sha256').update(`budget-seed:${organizationId}:${key}`).digest('hex').slice(0, 32)
}

async function findUserId() {
  const { data } = await dataConnect.executeGraphql<{ users: { id: string }[] }, { email: string }>(
    `query ReadUser($email: String!) { users(where: { email: { eq: $email } }, limit: 1) { id } }`,
    { variables: { email: email! } },
  )
  const userId = data.users[0]?.id

  if (!userId) {
    console.error(`Nobody has signed in as ${email} in the emulators yet. Sign in once, then run this again`)
    process.exit(1)
  }

  return userId
}

// The organization named, or the only one the account belongs to, with its members, oldest first
async function findOrganization(userId: string) {
  const { data } = await dataConnect.executeGraphql<
    { userOrganizations: { organizationId: string; organization: { name: string; slug: string | null } }[] },
    { userId: string }
  >(
    `query ReadMemberships($userId: String!) {
      userOrganizations(where: { userId: { eq: $userId } }) { organizationId organization { name slug } }
    }`,
    { variables: { userId } },
  )
  const memberships = data.userOrganizations
  const named = values.organization
  const membership = named
    ? memberships.find(
        ({ organizationId, organization }) =>
          organizationId === named.replaceAll('-', '').toLowerCase() || organization.slug === named,
      )
    : memberships.length === 1
      ? memberships[0]
      : undefined

  if (named && !membership) {
    console.error(`${email} is not a member of ${named}`)
    process.exit(1)
  }

  if (!membership) {
    console.error(
      memberships.length
        ? `${email} belongs to several organizations: name one with --organization\n${memberships.map(({ organizationId, organization }) => `  ${organization.slug ?? organizationId}  ${organization.name}`).join('\n')}`
        : `${email} belongs to no organization yet`,
    )
    process.exit(1)
  }

  const { data: members } = await dataConnect.executeGraphql<
    { userOrganizations: { userId: string }[] },
    { organizationId: string }
  >(
    `query ReadMembers($organizationId: UUID!) {
      userOrganizations(where: { organizationId: { eq: $organizationId } }, orderBy: [{ createdAt: ASC }]) { userId }
    }`,
    { variables: { organizationId: membership.organizationId } },
  )

  return {
    id: membership.organizationId,
    pathSegment: membership.organization.slug ?? membership.organizationId,
    memberIds: members.userOrganizations.map(member => member.userId),
  }
}

const userId = await findUserId()
const organization = await findOrganization(userId)
const today = readLocalToday()
const bills = buildSeedBills(today)

await dataConnect.executeGraphql(
  `mutation SeedBudget($organizationId: UUID!, $userId: String!) {
    budget_upsert(data: {
      organizationId: $organizationId
      currency: USD
      amountMinor: "250000"
      period: MONTHLY
      updatedById: $userId
      updatedAt_expr: "request.time"
    })
  }`,
  { variables: { organizationId: organization.id, userId } },
)

// One write a bill, since a connector cannot batch an insert, and the Admin SDK's GraphQL is held
// to the same
for (const { key, payer, amountMinor, ...fields } of bills) {
  await dataConnect.executeGraphql(`mutation SeedBill($data: Bill_Data!) { bill_upsert(data: $data) }`, {
    variables: {
      data: {
        ...fields,
        id: deriveBillId(organization.id, key),
        organizationId: organization.id,
        amountMinor: String(amountMinor),
        endsOn: null,
        paidById: organization.memberIds[PAYERS.indexOf(payer) % organization.memberIds.length],
        receiptId: null,
        createdById: userId,
        deletedAt: null,
      },
    },
  })
}

console.log(
  `Seeded a $2,500 monthly budget and ${bills.length} bills dated around ${today}: /${organization.pathSegment}/budget`,
)
