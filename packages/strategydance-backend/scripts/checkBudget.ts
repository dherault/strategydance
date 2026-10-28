import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  MAX_BILL_RECEIPT_SIZE,
  MAX_BILLS,
  MAX_DAILY_RECEIPT_READS_PER_MEMBER,
  MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION,
  MAX_MONEY_MINOR,
} from 'strategydance-core'
import {
  claimBillReceiptRead,
  completeBillReceiptUpload,
  connectorConfig,
  deleteBillReceipts,
  getBillReceiptForMember,
  getBillReceiptForReader,
  getBillReceiptReads,
  getPrunableBillReceipts,
  pruneDeletedBills,
  recordBillReceiptRead,
  releaseBillReceiptRead,
  reserveBillReceipt,
  type ReserveBillReceiptVariables,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the Budget's operations against the emulators, where CI cannot, since what they guard is in
  their SQL conditions:

    bun run check:budget

  It makes throwaway organizations, members and an outsider, runs the web connector's operations as
  those members, as the page will, and the backend connector's as the receipts' routes and the sweep
  call them, removes everything it made, then exits non-zero naming each check that failed. The
  operations go through the Admin SDK impersonating a member, so their `@auth` level and every
  `@check` are evaluated as for that member's token. The domain's tests run against a fake of the
  backend's operations: this is what says the fake's conditions are the SQL's.

  The sweep's operations take no organization, so they read and prune every receipt and bill of the
  emulator past its time; the checks look only at the rows they made.

  Like `checkTasksModule.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:budget`',
  )
  process.exit(1)
}

// The browser's connector, on an app of its own, as `checkConversationList.ts` explains
const webConnector = getDataConnect(
  { ...connectorConfig, connector: 'strategydance-web-connector' },
  initializeApp({ projectId: FIREBASE_PROJECT_ID }, 'web-connector'),
)

// Dashless, as the emulator writes a UUID back, so an id read compares with the one made
function createId() {
  return randomUUID().replaceAll('-', '')
}

const checkId = createId().slice(0, 8)
const organizationId = createId()
const otherOrganizationId = createId()
const fullOrganizationId = createId()
// Where the receipt reader's caps are filled, so no other check's receipt counts toward them
const readsOrganizationId = createId()

const userIds = {
  administrator: `check-budget-${checkId}-administrator`,
  member: `check-budget-${checkId}-member`,
  other: `check-budget-${checkId}-other`,
  leaver: `check-budget-${checkId}-leaver`,
  outsider: `check-budget-${checkId}-outsider`,
}

const HOUR_MS = 60 * 60 * 1000

const failures: string[] = []

function check(name: string, hasPassed: boolean) {
  console.log(`${hasPassed ? 'ok    ' : 'FAILED'}  ${name}`)

  if (!hasPassed) failures.push(name)
}

type Variables = Record<string, unknown>

async function write(query: string, variables: Variables = {}) {
  await dataConnect.executeGraphql(query, { variables })
}

async function read<Data>(query: string, variables: Variables = {}) {
  const { data } = await dataConnect.executeGraphql<Data, Variables>(query, { variables })

  return data
}

function as(userId: string) {
  return { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } }
}

// The cause of a refusal, which the Admin SDK puts on the first line of its message, or null when
// the operation went through
async function refusal(operation: Promise<unknown>) {
  try {
    await operation

    return null
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
  }
}

// Whether an operation was refused for the cause named, printing any other cause it was refused for
async function isRefused(operation: Promise<unknown>, cause: string) {
  const actual = await refusal(operation)

  if (actual !== null && !actual.includes(cause)) console.log(`        refused otherwise: ${actual}`)

  return actual?.includes(cause) ?? false
}

// Whether an operation went through, printing why it did not
async function isAccepted(operation: Promise<unknown>) {
  const actual = await refusal(operation)

  if (actual !== null) console.log(`        refused: ${actual}`)

  return actual === null
}

function runAs(userId: string, name: string, variables: Variables) {
  return webConnector.executeMutation(name, variables, as(userId))
}

async function readAs<Data>(userId: string, name: string, variables: Variables) {
  const { data } = await webConnector.executeQuery<Data, Variables>(name, variables, as(userId))

  return data
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR_MS).toISOString()
}

// A day `days` from today, `YYYY-MM-DD`, in UTC
function dayFromToday(days: number) {
  return new Date(Date.now() + days * 24 * HOUR_MS).toISOString().slice(0, 10)
}

type BudgetRow = { currency: string; amountMinor: string | null; period: string | null }

type BillRow = {
  id: string
  name: string
  amountMinor: string
  paidById: string | null
  paidBy: { displayName: string | null } | null
  receipt: { id: string; name: string; contentType: string; size: number } | null
  updatedAt: string
}

// What the page's form sends for a new bill, as a member of the checked organization fills it in
function newBill(fields: Variables = {}) {
  return {
    organizationId,
    id: createId(),
    name: 'Figma Professional',
    description: 'Design seats',
    company: 'Figma',
    amountMinor: '4500',
    currency: 'USD',
    paidOn: dayFromToday(-10),
    recurrence: 'MONTHLY',
    endsOn: null,
    paidById: userIds.member,
    receiptId: null,
    ...fields,
  }
}

// What the page's form sends to save a bill as it read it, with the fields changed
function savedBill(bill: BillRow, fields: Variables = {}) {
  return {
    organizationId,
    id: bill.id,
    updatedAt: bill.updatedAt,
    name: bill.name,
    description: '',
    company: 'Figma',
    amountMinor: bill.amountMinor,
    currency: 'USD',
    paidOn: dayFromToday(-10),
    recurrence: 'MONTHLY',
    endsOn: null,
    paidById: bill.paidById,
    receiptId: bill.receipt?.id ?? null,
    ...fields,
  }
}

async function readBills(userId = userIds.member, organization = organizationId) {
  return (await readAs<{ bills: BillRow[] }>(userId, 'GetBills', { organizationId: organization })).bills
}

async function readBill(id: string) {
  return (await readBills()).find(bill => bill.id === id)
}

// A receipt written straight into its table, as an upload long ago left it
async function insertReceipt(fields: Variables = {}) {
  const id = createId()

  await write(`mutation InsertReceipt($data: BillReceipt_Data!) { billReceipt_insert(data: $data) }`, {
    data: {
      id,
      organizationId,
      userId: userIds.member,
      status: 'READY',
      name: 'Invoice.pdf',
      contentType: 'application/pdf',
      size: 1000,
      ...fields,
    },
  })

  return id
}

// A bill written straight into its table, as a page long ago saved it
async function insertBill(fields: Variables = {}) {
  const id = createId()

  await write(`mutation InsertBill($data: Bill_Data!) { bill_insert(data: $data) }`, {
    data: {
      id,
      organizationId,
      name: 'Inserted',
      company: 'Company',
      amountMinor: '100',
      currency: 'USD',
      paidOn: dayFromToday(-1),
      paidById: userIds.member,
      ...fields,
    },
  })

  return id
}

async function readReceiptRow(id: string) {
  const data = await read<{ billReceipt: { status: string } | null }>(
    `query ReadReceipt($id: UUID!) { billReceipt(id: $id) { status } }`,
    { id },
  )

  return data.billReceipt
}

async function readBillRow(id: string) {
  const data = await read<{ bill: { deletedAt: string | null; receiptId: string | null } | null }>(
    `query ReadBill($id: UUID!) { bill(id: $id) { deletedAt receiptId } }`,
    { id },
  )

  return data.bill
}

async function setUp() {
  // Each signs up as the app has them do, since a user's row takes its id and address off the token
  for (const userId of Object.values(userIds)) {
    await webConnector.executeMutation('CreateCurrentUser', { locale: 'EN', authenticationProviders: [] }, as(userId))
  }

  await write(
    `mutation SetUp(
      $organizationId: UUID!
      $otherOrganizationId: UUID!
      $fullOrganizationId: UUID!
      $readsOrganizationId: UUID!
      $administrator: String!
      $member: String!
      $other: String!
      $leaver: String!
      $outsider: String!
    ) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      other: organization_insert(data: { id: $otherOrganizationId, name: "Other organization" })
      full: organization_insert(data: { id: $fullOrganizationId, name: "Full organization" })
      reads: organization_insert(data: { id: $readsOrganizationId, name: "Read organization" })
      administrator: userOrganization_insert(data: { userId: $administrator, organizationId: $organizationId, role: ADMINISTRATOR })
      member: userOrganization_insert(data: { userId: $member, organizationId: $organizationId, role: MEMBER })
      otherMember: userOrganization_insert(data: { userId: $other, organizationId: $organizationId, role: MEMBER })
      leaver: userOrganization_insert(data: { userId: $leaver, organizationId: $organizationId, role: MEMBER })
      outsider: userOrganization_insert(data: { userId: $outsider, organizationId: $otherOrganizationId, role: MEMBER })
      fullMember: userOrganization_insert(data: { userId: $member, organizationId: $fullOrganizationId, role: MEMBER })
      readsMember: userOrganization_insert(data: { userId: $member, organizationId: $readsOrganizationId, role: MEMBER })
      readsOther: userOrganization_insert(data: { userId: $other, organizationId: $readsOrganizationId, role: MEMBER })
    }`,
    { organizationId, otherOrganizationId, fullOrganizationId, readsOrganizationId, ...userIds },
  )
}

async function tearDown() {
  await write(
    `mutation TearDown($ids: [UUID!]!, $userIds: [String!]!) {
      organization_deleteMany(where: { id: { in: $ids } })
      user_deleteMany(where: { id: { in: $userIds } })
    }`,
    {
      ids: [organizationId, otherOrganizationId, fullOrganizationId, readsOrganizationId],
      userIds: Object.values(userIds),
    },
  )
}

async function checkBudget() {
  const budget = (currency: string, amountMinor: string | null, period: string | null) => ({
    organizationId,
    currency,
    amountMinor,
    period,
  })
  const readBudget = async (userId: string) =>
    (await readAs<{ budgets: BudgetRow[] }>(userId, 'GetBudget', { organizationId })).budgets[0]

  check('a member reads no budget before one is set', (await readBudget(userIds.member)) === undefined)
  check(
    'an administrator sets the budget',
    await isAccepted(runAs(userIds.administrator, 'SetBudget', budget('EUR', '250000', 'MONTHLY'))),
  )

  const set = await readBudget(userIds.member)

  check(
    'a member reads it, its amount in minor units',
    set?.currency === 'EUR' && set.amountMinor === '250000' && set.period === 'MONTHLY',
  )
  check('an outsider reads no budget', (await readBudget(userIds.outsider)) === undefined)
  check(
    "a member's set is refused",
    await isRefused(
      runAs(userIds.member, 'SetBudget', budget('USD', '100', 'YEARLY')),
      'Only an administrator can set the budget',
    ),
  )
  check(
    "an outsider's set is refused",
    await isRefused(
      runAs(userIds.outsider, 'SetBudget', budget('USD', '100', 'YEARLY')),
      'Only a member of an organization can set its budget',
    ),
  )
  check(
    'an amount without a period is refused',
    await isRefused(runAs(userIds.administrator, 'SetBudget', budget('USD', '100', null)), 'or neither'),
  )
  check(
    'a period without an amount is refused',
    await isRefused(runAs(userIds.administrator, 'SetBudget', budget('USD', null, 'YEARLY')), 'or neither'),
  )
  check(
    'a set leaving the amount and the period out is refused',
    await isRefused(runAs(userIds.administrator, 'SetBudget', { organizationId, currency: 'USD' }), 'or neither'),
  )
  check(
    'an amount of 0 is refused',
    await isRefused(runAs(userIds.administrator, 'SetBudget', budget('USD', '0', 'YEARLY')), '1 to 10^15'),
  )
  check(
    'an amount past MAX_MONEY_MINOR is refused',
    await isRefused(
      runAs(userIds.administrator, 'SetBudget', budget('USD', String(MAX_MONEY_MINOR + 1), 'YEARLY')),
      '1 to 10^15',
    ),
  )
  check(
    'an amount of MAX_MONEY_MINOR is taken',
    await isAccepted(runAs(userIds.administrator, 'SetBudget', budget('USD', String(MAX_MONEY_MINOR), 'YEARLY'))),
  )
  check(
    'removing the budget is taken',
    await isAccepted(runAs(userIds.administrator, 'SetBudget', budget('EUR', null, null))),
  )

  const removed = await readBudget(userIds.member)

  check(
    'a removed budget keeps its currency',
    removed?.currency === 'EUR' && removed.amountMinor === null && removed.period === null,
  )
}

async function checkBillFields() {
  const created = newBill()

  check('a member adds a bill', await isAccepted(runAs(userIds.member, 'CreateBill', created)))

  const bill = await readBill(created.id)

  check(
    'it is read with its payer and its amount in minor units',
    bill?.amountMinor === '4500' && bill.paidById === userIds.member && bill.paidBy !== null,
  )
  check(
    'a save sent again with its id stores it once',
    (await refusal(runAs(userIds.member, 'CreateBill', created))) !== null
      && (await readBills()).filter(({ id }) => id === created.id).length === 1,
  )
  check(
    "an outsider's add is refused",
    await isRefused(
      runAs(userIds.outsider, 'CreateBill', newBill()),
      'Only a member of an organization can add to its bills',
    ),
  )
  check('an outsider reads no bill', (await readBills(userIds.outsider)).length === 0)

  const nameOrCompany = "A bill's name and company"
  const refusals: [string, Variables, string][] = [
    ['an empty name', { name: '' }, nameOrCompany],
    ['a name with a space at its end', { name: 'Figma ' }, nameOrCompany],
    ['a name on two lines', { name: 'Fig\nma' }, nameOrCompany],
    ['a name of 81 characters', { name: 'a'.repeat(81) }, nameOrCompany],
    ['a company of 61 characters', { company: 'a'.repeat(61) }, nameOrCompany],
    ['an empty company', { company: '' }, nameOrCompany],
    ['a description of 141 characters', { description: 'a'.repeat(141) }, nameOrCompany],
    ['an amount of 0', { amountMinor: '0' }, '1 to 10^15'],
    ['an amount past MAX_MONEY_MINOR', { amountMinor: String(MAX_MONEY_MINOR + 1) }, '1 to 10^15'],
    ['a payment before 1999', { paidOn: '1998-12-31' }, 'from 1999 to ten years ahead'],
    ['a payment eleven years ahead', { paidOn: dayFromToday(11 * 366) }, 'from 1999 to ten years ahead'],
    ['an end on a one-time bill', { recurrence: null, endsOn: dayFromToday(30) }, 'ends only when it recurs'],
    ['an end before the first payment', { endsOn: dayFromToday(-20) }, 'ends only when it recurs'],
    ['a payer from another organization', { paidById: userIds.outsider }, 'paid by a member of its organization'],
  ]

  for (const [label, fields, cause] of refusals) {
    check(
      `a bill with ${label} is refused`,
      await isRefused(runAs(userIds.member, 'CreateBill', newBill(fields)), cause),
    )
  }

  check(
    'a bill paid on 1999-01-01, ending on its first payment, a name of 80 characters and a description of 140 is taken',
    await isAccepted(
      runAs(
        userIds.member,
        'CreateBill',
        newBill({
          name: 'a'.repeat(80),
          company: 'b'.repeat(60),
          description: 'c'.repeat(140),
          paidOn: '1999-01-01',
          endsOn: '1999-01-01',
        }),
      ),
    ),
  )
}

async function checkReceiptOperations() {
  const reserve = (fields: Variables = {}) =>
    reserveBillReceipt(dataConnect, {
      organizationId,
      userId: userIds.member,
      receiptId: createId(),
      name: 'Invoice.pdf',
      contentType: 'application/pdf',
      size: 1000,
      ...fields,
    } as ReserveBillReceiptVariables)

  const receiptId = createId()

  check('a member reserves a receipt', await isAccepted(reserve({ receiptId })))
  check('it is uploading', (await readReceiptRow(receiptId))?.status === 'UPLOADING')
  check(
    "an outsider's reservation is refused",
    await isRefused(
      reserve({ userId: userIds.outsider }),
      'Only a member of an organization can upload a receipt to it',
    ),
  )
  check(
    'a reservation of a type a bill does not take is refused',
    await isRefused(reserve({ contentType: 'image/gif' }), 'a type a bill takes'),
  )
  check(
    'a reservation past 10 MiB is refused',
    await isRefused(reserve({ size: MAX_BILL_RECEIPT_SIZE + 1 }), 'a type a bill takes'),
  )
  check('an empty reservation is refused', await isRefused(reserve({ size: 0 }), 'a type a bill takes'))
  check('a name on two lines is refused', await isRefused(reserve({ name: 'Invoice\n.pdf' }), 'a type a bill takes'))
  check(
    'a name of 201 characters is refused',
    await isRefused(reserve({ name: 'a'.repeat(201) }), 'a type a bill takes'),
  )
  check(
    "another member's completion is refused",
    await isRefused(
      completeBillReceiptUpload(dataConnect, { organizationId, userId: userIds.other, receiptId }),
      'no longer being uploaded',
    ),
  )
  check(
    'its uploader completes it',
    await isAccepted(completeBillReceiptUpload(dataConnect, { organizationId, userId: userIds.member, receiptId })),
  )
  check('it is ready', (await readReceiptRow(receiptId))?.status === 'READY')
  check(
    'a second completion is refused',
    await isRefused(
      completeBillReceiptUpload(dataConnect, { organizationId, userId: userIds.member, receiptId }),
      'no longer being uploaded',
    ),
  )

  const { data } = await getBillReceiptForMember(dataConnect, { organizationId, userId: userIds.other, receiptId })

  check(
    'another member reads it with their membership',
    data.userOrganization !== undefined && data.billReceipt?.userId === userIds.member,
  )

  const { data: outsider } = await getBillReceiptForMember(dataConnect, {
    organizationId,
    userId: userIds.outsider,
    receiptId,
  })

  check('an outsider reads no membership beside it', !outsider.userOrganization)
}

async function readReceiptRead(id: string) {
  const data = await read<{ billReceipt: { readAt: string | null; readFields: string | null } | null }>(
    `query ReadReceiptRead($id: UUID!) { billReceipt(id: $id) { readAt readFields } }`,
    { id },
  )

  return data.billReceipt
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

async function checkReceiptReadOperations() {
  const reference = (receiptId: string, userId = userIds.member) => ({ organizationId, userId, receiptId })
  // Each receipt's claim, once accepted, which its record and its release name, as the reader's do
  const claims = new Map<string, string>()
  const claim = async (receiptId: string, userId = userIds.member) => {
    const readClaim = createId()
    const result = await claimBillReceiptRead(dataConnect, { ...reference(receiptId, userId), readClaim })

    claims.set(receiptId, readClaim)

    return result
  }
  const claimed = (receiptId: string) => ({ ...reference(receiptId), readClaim: claims.get(receiptId) ?? createId() })
  const fields = JSON.stringify({ name: 'Figma Professional' })
  const again = 'being read, or was read already'

  const receiptId = await insertReceipt()

  check('its uploader claims a ready receipt for the reader', await isAccepted(claim(receiptId)))
  check('the claim sets when it was read', (await readReceiptRead(receiptId))?.readAt !== null)
  check('a second claim is refused', await isRefused(claim(receiptId), again))
  check(
    "another member's claim of a receipt is refused",
    await isRefused(claim(await insertReceipt(), userIds.other), again),
  )
  check(
    "an outsider's claim is refused",
    await isRefused(claim(await insertReceipt(), userIds.outsider), 'Only a member of an organization'),
  )
  check(
    "a receipt still uploading can't be claimed",
    await isRefused(claim(await insertReceipt({ status: 'UPLOADING' })), again),
  )

  const { data } = await getBillReceiptForReader(dataConnect, reference(receiptId))

  check(
    'the reader reads the receipt with its organization’s name',
    data.userOrganization?.organization.name === 'Checked organization' && data.billReceipt?.readAt !== null,
  )

  await releaseBillReceiptRead(dataConnect, { ...reference(receiptId), readClaim: createId() })

  check('a release naming another claim lets nothing go', (await readReceiptRead(receiptId))?.readAt !== null)

  await releaseBillReceiptRead(dataConnect, claimed(receiptId))

  check('a release clears the claim', (await readReceiptRead(receiptId))?.readAt === null)
  check('a receipt let go is claimed again', await isAccepted(claim(receiptId)))
  check(
    'a record naming another claim is refused',
    await isRefused(
      recordBillReceiptRead(dataConnect, { ...reference(receiptId), readClaim: createId(), readFields: fields }),
      'no longer being read',
    ),
  )
  check(
    'what the read found is kept',
    await isAccepted(recordBillReceiptRead(dataConnect, { ...claimed(receiptId), readFields: fields })),
  )
  check('it is stored with the receipt', (await readReceiptRead(receiptId))?.readFields === fields)
  check(
    'a second record is refused',
    await isRefused(
      recordBillReceiptRead(dataConnect, { ...claimed(receiptId), readFields: fields }),
      'no longer being read',
    ),
  )

  await releaseBillReceiptRead(dataConnect, claimed(receiptId))

  check(
    'a release after the record keeps the claim, and a claim is refused',
    (await readReceiptRead(receiptId))?.readAt !== null && (await isRefused(claim(receiptId), again)),
  )

  const long = await insertReceipt()

  await claim(long)
  check(
    'a record past 2000 characters is refused',
    await isRefused(
      recordBillReceiptRead(dataConnect, { ...claimed(long), readFields: 'a'.repeat(2001) }),
      'fits in 2000 characters',
    ),
  )
  check(
    'a record without a claim is refused',
    await isRefused(
      recordBillReceiptRead(dataConnect, { ...claimed(await insertReceipt()), readFields: fields }),
      'no longer being read',
    ),
  )
  check(
    'a claim over two minutes old that stored nothing is taken over',
    await isAccepted(claim(await insertReceipt({ readAt: minutesAgo(3) }))),
  )
  check(
    'one under two minutes old is not',
    await isRefused(claim(await insertReceipt({ readAt: minutesAgo(1) })), again),
  )
  check(
    'nor one whose fields are stored, however old',
    await isRefused(claim(await insertReceipt({ readAt: hoursAgo(30), readFields: fields })), again),
  )
}

async function checkReceiptReadCaps() {
  const reference = (receiptId: string, userId = userIds.member) => ({
    organizationId: readsOrganizationId,
    userId,
    receiptId,
  })
  const claim = (
    receiptId: string,
    { userId = userIds.member, isUsageCapped }: { userId?: string; isUsageCapped?: boolean } = {},
  ) =>
    claimBillReceiptRead(dataConnect, {
      ...reference(receiptId, userId),
      readClaim: createId(),
      ...(isUsageCapped === undefined ? {} : { isUsageCapped }),
    })
  const newReceipt = (userId = userIds.member) => insertReceipt({ organizationId: readsOrganizationId, userId })

  // Receipts read so many hours ago, each a second older than the one before, in batches of 100
  async function insertReads(count: number, { userId, hours }: { userId: string | null; hours: number }) {
    const rows = Array.from({ length: count }, (_, index) => ({
      id: createId(),
      organizationId: readsOrganizationId,
      userId,
      status: 'READY',
      name: 'Invoice.pdf',
      contentType: 'application/pdf',
      size: 1000,
      readAt: new Date(Date.now() - hours * HOUR_MS - index * 1000).toISOString(),
      readFields: '{}',
    }))

    for (let index = 0; index < rows.length; index += 100) {
      await write(`mutation InsertReads($rows: [BillReceipt_Data!]!) { billReceipt_insertMany(data: $rows) }`, {
        rows: rows.slice(index, index + 100),
      })
    }
  }

  // One place left for the member, and reads too old to count
  await insertReads(MAX_DAILY_RECEIPT_READS_PER_MEMBER - 1, { userId: userIds.member, hours: 1 })
  await insertReads(3, { userId: userIds.member, hours: 25 })

  const last = await newReceipt()
  const past = await newReceipt()

  check(
    `the member's ${MAX_DAILY_RECEIPT_READS_PER_MEMBER}th read in 24 hours is claimed, older reads not counting`,
    await isAccepted(claim(last)),
  )
  check(
    `the ${MAX_DAILY_RECEIPT_READS_PER_MEMBER + 1}st is refused`,
    await isRefused(claim(past), `at most ${MAX_DAILY_RECEIPT_READS_PER_MEMBER} receipts read in 24 hours`),
  )
  check('the caps lifted, it is claimed', await isAccepted(claim(past, { isUsageCapped: false })))

  const { data: memberReads } = await getBillReceiptReads(dataConnect, reference(await newReceipt()))

  check(
    'the reads are read newest first, as many as the cap counts',
    memberReads.memberReads.length === MAX_DAILY_RECEIPT_READS_PER_MEMBER
      && memberReads.memberReads.every(
        ({ readAt }, index, rows) => index === 0 || Date.parse(readAt!) <= Date.parse(rows[index - 1]!.readAt!),
      ),
  )

  const { data: ownLeftOut } = await getBillReceiptReads(dataConnect, reference(past))

  check('the receipt a read asks for counts toward neither cap', !ownLeftOut.memberReads.some(({ id }) => id === past))

  // The member's 51 within 24 hours, then reads of accounts gone, which count toward the
  // organization's cap alone, to one short of it
  await insertReads(MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION - MAX_DAILY_RECEIPT_READS_PER_MEMBER - 2, {
    userId: null,
    hours: 2,
  })

  const othersLast = await newReceipt(userIds.other)
  const othersPast = await newReceipt(userIds.other)

  check(
    `the organization's ${MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION}th read is claimed`,
    await isAccepted(claim(othersLast, { userId: userIds.other })),
  )
  check(
    `the ${MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION + 1}st is refused, whoever asks`,
    await isRefused(
      claim(othersPast, { userId: userIds.other }),
      `at most ${MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION} receipts read in 24 hours`,
    ),
  )

  const { data: organizationReads } = await getBillReceiptReads(dataConnect, reference(othersPast, userIds.other))

  check(
    "the organization's reads are read to its cap",
    organizationReads.organizationReads.length === MAX_DAILY_RECEIPT_READS_PER_ORGANIZATION,
  )
}

async function checkReceiptsOfBills() {
  const attach = (receiptId: string, userId = userIds.member) => runAs(userId, 'CreateBill', newBill({ receiptId }))
  const again = 'attach it again'

  const own = await insertReceipt()
  const ownBill = newBill({ receiptId: own })

  check("a member's ready receipt is attached", await isAccepted(runAs(userIds.member, 'CreateBill', ownBill)))
  check('the bill is read with its receipt', (await readBill(ownBill.id))?.receipt?.id === own)
  check(
    'a receipt still uploading is refused',
    await isRefused(attach(await insertReceipt({ status: 'UPLOADING' })), again),
  )
  check(
    "another member's receipt is refused",
    await isRefused(attach(await insertReceipt({ userId: userIds.other })), again),
  )
  check(
    "another organization's receipt is refused",
    await isRefused(attach(await insertReceipt({ organizationId: otherOrganizationId })), again),
  )
  check('a receipt another bill holds is refused', await isRefused(attach(own), again))
  check(
    'a receipt nothing holds over two days old is refused',
    await isRefused(attach(await insertReceipt({ createdAt: hoursAgo(49) })), again),
  )

  // A bill keeps what it holds already, whoever uploaded it and however long ago
  const old = await insertReceipt({ userId: userIds.other, createdAt: hoursAgo(100) })
  const holder = await insertBill({ receiptId: old })
  const holderRow = await readBill(holder)

  check(
    "a save keeps the bill's own receipt, another member's from days ago",
    holderRow !== undefined
      && (await isAccepted(runAs(userIds.member, 'UpdateBill', savedBill(holderRow, { name: 'Renamed' })))),
  )

  const fresh = await insertReceipt()
  const renamed = await readBill(holder)

  check(
    'a save replaces it with a fresh receipt of the member',
    renamed !== undefined
      && (await isAccepted(runAs(userIds.member, 'UpdateBill', savedBill(renamed, { receiptId: fresh })))),
  )
  check('the bill holds the fresh one', (await readBillRow(holder))?.receiptId === fresh)

  const replaced = await readBill(holder)

  check(
    'the replaced receipt, over two days old and held by nothing now, is not taken back',
    replaced !== undefined
      && (await isRefused(runAs(userIds.member, 'UpdateBill', savedBill(replaced, { receiptId: old })), again)),
  )
  // By the unique reference, which Data Connect reports before the receipt's check in one statement
  const taken =
    replaced === undefined
      ? null
      : await refusal(runAs(userIds.member, 'UpdateBill', savedBill(replaced, { receiptId: own })))

  check(
    "a save taking another bill's receipt is refused",
    taken !== null && (taken.includes(again) || taken.includes('bill_receiptId_uidx')),
  )
  check(
    'a save removes its receipt',
    replaced !== undefined
      && (await isAccepted(runAs(userIds.member, 'UpdateBill', savedBill(replaced, { receiptId: null })))),
  )
  check('the bill holds none', (await readBillRow(holder))?.receiptId === null)
}

async function checkSaving() {
  const created = newBill({ paidById: userIds.leaver })

  await runAs(userIds.member, 'CreateBill', created)

  const bill = await readBill(created.id)

  if (!bill) {
    check('a bill to save is added', false)

    return
  }

  check(
    'a save with the updatedAt read is taken',
    await isAccepted(runAs(userIds.member, 'UpdateBill', savedBill(bill, { name: 'First' }))),
  )
  check(
    "a save on what another member's save replaced is refused",
    await isRefused(
      runAs(userIds.other, 'UpdateBill', savedBill(bill, { name: 'Second' })),
      'changed elsewhere since it was read',
    ),
  )

  await write(
    `mutation Leave($organizationId: UUID!, $userId: String!) {
      userOrganization_delete(key: { userId: $userId, organizationId: $organizationId })
    }`,
    { organizationId, userId: userIds.leaver },
  )

  const current = await readBill(created.id)

  check(
    'a save keeps a payer who has left',
    current !== undefined
      && (await isAccepted(runAs(userIds.member, 'UpdateBill', savedBill(current, { name: 'Third' })))),
  )

  const another = newBill()

  await runAs(userIds.member, 'CreateBill', another)

  const anotherBill = await readBill(another.id)

  check(
    'a save naming a payer who has left on another bill is refused',
    anotherBill !== undefined
      && (await isRefused(
        runAs(userIds.member, 'UpdateBill', savedBill(anotherBill, { paidById: userIds.leaver })),
        'or by whoever paid it',
      )),
  )
  check(
    'a payer who has left is refused on a new bill',
    await isRefused(
      runAs(userIds.member, 'CreateBill', newBill({ paidById: userIds.leaver })),
      'paid by a member of its organization',
    ),
  )
  check(
    "an outsider's save is refused",
    anotherBill !== undefined
      && (await isRefused(
        runAs(userIds.outsider, 'UpdateBill', savedBill(anotherBill)),
        'Only a member of an organization can change its bills',
      )),
  )
}

async function checkDeletingAndRestoring() {
  const created = newBill()

  await runAs(userIds.member, 'CreateBill', created)

  const bill = await readBill(created.id)

  check(
    'a member deletes a bill',
    await isAccepted(runAs(userIds.other, 'DeleteBill', { organizationId, id: created.id })),
  )
  check('it is read no more', (await readBill(created.id)) === undefined)
  check(
    'deleting it again changes nothing and succeeds',
    await isAccepted(runAs(userIds.other, 'DeleteBill', { organizationId, id: created.id })),
  )
  check(
    'a deleted bill is not saved',
    bill !== undefined
      && (await isRefused(runAs(userIds.member, 'UpdateBill', savedBill(bill)), 'changed elsewhere since it was read')),
  )
  check(
    'a member restores it within a day',
    await isAccepted(runAs(userIds.member, 'RestoreBill', { organizationId, id: created.id })),
  )
  check('it is read again', (await readBill(created.id)) !== undefined)
  check(
    "an outsider's delete is refused",
    await isRefused(
      runAs(userIds.outsider, 'DeleteBill', { organizationId, id: created.id }),
      'Only a member of an organization can change its bills',
    ),
  )

  const old = await insertBill({ deletedAt: hoursAgo(25) })

  check(
    'a bill deleted over a day ago is gone for good',
    await isRefused(runAs(userIds.member, 'RestoreBill', { organizationId, id: old }), 'gone for good'),
  )
}

async function checkCap() {
  // In batches of 100, the most one insert takes, one short of the cap, with a deleted one to restore
  const rows = Array.from({ length: MAX_BILLS - 1 }, (_, index) => ({
    id: createId(),
    organizationId: fullOrganizationId,
    name: `Bill ${index}`,
    company: 'Company',
    amountMinor: '100',
    currency: 'USD',
    paidOn: dayFromToday(-1),
    paidById: userIds.member,
  }))

  for (let index = 0; index < rows.length; index += 100) {
    await write(`mutation InsertBills($rows: [Bill_Data!]!) { bill_insertMany(data: $rows) }`, {
      rows: rows.slice(index, index + 100),
    })
  }

  const deleted = createId()

  await write(`mutation InsertDeleted($data: Bill_Data!) { bill_insert(data: $data) }`, {
    data: { ...rows[0], id: deleted, deletedAt: hoursAgo(1) },
  })

  check(
    `the ${MAX_BILLS}th bill is taken`,
    await isAccepted(runAs(userIds.member, 'CreateBill', newBill({ organizationId: fullOrganizationId }))),
  )
  check(
    `the ${MAX_BILLS + 1}st is refused`,
    await isRefused(
      runAs(userIds.member, 'CreateBill', newBill({ organizationId: fullOrganizationId })),
      `at most ${MAX_BILLS} bills`,
    ),
  )
  check(
    'a restore at the cap is refused',
    await isRefused(
      runAs(userIds.member, 'RestoreBill', { organizationId: fullOrganizationId, id: deleted }),
      `at most ${MAX_BILLS} bills`,
    ),
  )
  check(
    'the page reads every bill at the cap',
    (await readBills(userIds.member, fullOrganizationId)).length === MAX_BILLS,
  )
}

async function checkRemovedMember() {
  const receiptId = await insertReceipt({ userId: userIds.leaver })

  await insertBill({ receiptId })

  // The leaver was removed by `checkSaving`
  const { data } = await getBillReceiptForMember(dataConnect, { organizationId, userId: userIds.other, receiptId })

  check(
    "a removed member's receipt is kept and served to a member",
    data.userOrganization !== undefined && data.billReceipt?.userId === userIds.leaver,
  )

  await write(`mutation DeleteAccount($userId: String!) { user_delete(id: $userId) }`, { userId: userIds.leaver })

  const { data: orphaned } = await getBillReceiptForMember(dataConnect, {
    organizationId,
    userId: userIds.other,
    receiptId,
  })

  check(
    "a receipt whose uploader's account went stays, held by its bill",
    orphaned.billReceipt?.userId === null && (await readReceiptRow(receiptId)) !== null,
  )
}

async function checkPrunes() {
  const prunable = await insertReceipt({ createdAt: hoursAgo(73) })
  const uploading = await insertReceipt({ status: 'UPLOADING', createdAt: hoursAgo(73) })
  // Past the two days a save takes it in, a day short of the sweep's three
  const recent = await insertReceipt({ createdAt: hoursAgo(49) })
  const held = await insertReceipt({ createdAt: hoursAgo(73) })
  const ofDeleted = await insertReceipt({ createdAt: hoursAgo(73) })
  const ofPruned = await insertReceipt({ createdAt: hoursAgo(73) })

  await insertBill({ receiptId: held })
  await insertBill({ receiptId: ofDeleted, deletedAt: hoursAgo(1) })

  const pruned = await insertBill({ receiptId: ofPruned, deletedAt: hoursAgo(25) })
  const kept = await insertBill({ deletedAt: hoursAgo(1) })

  const listed = async () => new Set((await getPrunableBillReceipts(dataConnect)).data.billReceipts.map(({ id }) => id))
  const before = await listed()

  check(
    'the sweep lists a receipt nothing holds three days old, ready or uploading',
    before.has(prunable) && before.has(uploading),
  )
  check(
    "it leaves one past a save's two days but under three, one a bill holds, and one a deleted bill holds",
    !before.has(recent) && !before.has(held) && !before.has(ofDeleted) && !before.has(ofPruned),
  )

  await pruneDeletedBills(dataConnect)

  check('the sweep prunes a bill deleted over a day ago', (await readBillRow(pruned)) === null)
  check('it keeps one deleted since', (await readBillRow(kept)) !== null)
  check('its receipt, held by nothing now, is listed next', (await listed()).has(ofPruned))

  await deleteBillReceipts(dataConnect, { ids: [prunable, uploading, ofPruned, recent, held, ofDeleted] })

  check(
    'it deletes the rows of those it listed',
    (await readReceiptRow(prunable)) === null
      && (await readReceiptRow(uploading)) === null
      && (await readReceiptRow(ofPruned)) === null,
  )
  check(
    'and never one younger or held, named or not',
    (await readReceiptRow(recent)) !== null
      && (await readReceiptRow(held)) !== null
      && (await readReceiptRow(ofDeleted)) !== null,
  )
}

try {
  await setUp()
  await checkBudget()
  await checkBillFields()
  await checkReceiptOperations()
  await checkReceiptReadOperations()
  await checkReceiptReadCaps()
  await checkReceiptsOfBills()
  await checkSaving()
  await checkDeletingAndRestoring()
  await checkCap()
  await checkRemovedMember()
  await checkPrunes()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')

process.exit(0)
