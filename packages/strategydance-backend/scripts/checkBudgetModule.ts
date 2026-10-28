import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import { MAX_AGENT_BILL_RECEIPT_SIZE, MAX_BILL_RECEIPT_SIZE, MAX_BILLS } from 'strategydance-core'
import {
  BillRecurrence,
  claimQueuedConversationRun,
  CompanyAspect,
  completeBillReceiptUpload,
  connectorConfig,
  ConversationActor,
  ConversationRunStatus,
  createBillForAgent,
  Currency,
  deleteBillForAgent,
  finishConversationRun,
  getBillForAgent,
  getBudgetForAgent,
  getConversationAttachmentForAgent,
  getExchangeRatesForAgent,
  getModuleCallResult,
  launchSubagent,
  reserveAttachmentBillReceiptForAgent,
  reserveBillReceiptForAgent,
  restoreBillForAgent,
  startConversation,
  updateBillForAgent,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

/*
  Checks the Budget module's operations against the emulators, where CI cannot, since what they guard
  is in their SQL conditions:

    bun run check:budget-module

  It makes three throwaway organizations, one for the bills, one whose receipts are another's, and
  one filled to its cap, with members, and a conversation with a subagent whose files Strategy
  Dance's agent names as receipts, calls the backend connector's own operations as the module calls
  them, removes everything it made, then exits non-zero naming each check that failed. The
  module's tests run against a fake of these operations: this is what says the fake's conditions are
  the SQL's.

  Like `checkBudget.ts`, it refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run check:budget-module`',
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
const userIds = {
  member: `check-budget-module-${checkId}-member`,
  other: `check-budget-module-${checkId}-other`,
  leaver: `check-budget-module-${checkId}-leaver`,
  outsider: `check-budget-module-${checkId}-outsider`,
}
const scope = `connection:check-${checkId}`
const HOUR_MS = 60 * 60 * 1000

// The createdAt of a membership that ended, which no operation finds
const STALE = '2020-01-01T00:00:00Z'

// What the agent's writes take for a call without a key
const UNKEYED = {
  isKeyed: false,
  idempotencyScope: '',
  idempotencyKey: '',
  tool: '',
  argumentsHash: '',
  result: '',
  expiresAt: null,
}

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

async function isRefused(operation: Promise<unknown>, cause: string) {
  return (await refusal(operation))?.includes(cause) ?? false
}

async function isAccepted(operation: Promise<unknown>) {
  return (await refusal(operation)) === null
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR_MS).toISOString()
}

// A day `days` from today, `YYYY-MM-DD`, in UTC
function dayFromToday(days: number) {
  return new Date(Date.now() + days * 24 * HOUR_MS).toISOString().slice(0, 10)
}

const memberships: Record<string, string> = {}

// The member the module acts as, in an organization, with the membership it read
function caller(organization = organizationId) {
  return {
    organizationId: organization,
    userId: userIds.member,
    membershipCreatedAt: memberships[organization] ?? '',
  }
}

// A bill's fields as the module sends them, with nothing to say against them
function billFields(fields: Variables = {}) {
  return {
    name: 'Created',
    description: '',
    company: 'Company',
    amountMinor: '1000',
    currency: Currency.USD,
    paidOn: dayFromToday(-1),
    recurrence: null,
    endsOn: null,
    paidById: userIds.member,
    receiptId: null,
    ...fields,
  }
}

function create(fields: Variables = {}) {
  return createBillForAgent(dataConnect, {
    ...caller(),
    id: createId(),
    ...billFields(),
    ...UNKEYED,
    ...fields,
  })
}

async function update(id: string, fields: Variables = {}) {
  const updatedAt = (await readBillRow(id))?.updatedAt ?? ''

  return updateBillForAgent(dataConnect, {
    ...caller(),
    id,
    updatedAt,
    ...billFields(),
    ...UNKEYED,
    ...fields,
  })
}

// A receipt written straight into its table, as an upload would have stored it
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

// A bill written straight into its table, as a page saved it
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

type BillRow = {
  name: string
  amountMinor: string
  paidById: string | null
  receiptId: string | null
  deletedAt: string | null
  updatedAt: string
}

async function readBillRow(id: string) {
  const data = await read<{ bill: BillRow | null }>(
    `query ReadBill($id: UUID!) { bill(id: $id) { name amountMinor paidById receiptId deletedAt updatedAt } }`,
    { id },
  )

  return data.bill
}

async function readReceiptRow(id: string) {
  const data = await read<{ billReceipt: { status: string; userId: string | null } | null }>(
    `query ReadReceipt($id: UUID!) { billReceipt(id: $id) { status userId } }`,
    { id },
  )

  return data.billReceipt
}

async function setUp() {
  // Each signs up as the app has them do, since a user's row takes its id and address off the token
  for (const userId of Object.values(userIds)) {
    await webConnector.executeMutation(
      'CreateCurrentUser',
      { locale: 'EN', authenticationProviders: [] },
      { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
    )
  }

  await write(
    `mutation SetUp(
      $organizationId: UUID!
      $otherOrganizationId: UUID!
      $fullOrganizationId: UUID!
      $member: String!
      $other: String!
      $leaver: String!
      $outsider: String!
    ) {
      organization_insert(data: { id: $organizationId, name: "Checked organization" })
      other: organization_insert(data: { id: $otherOrganizationId, name: "Other organization" })
      full: organization_insert(data: { id: $fullOrganizationId, name: "Full organization" })
      member: userOrganization_insert(data: { userId: $member, organizationId: $organizationId, role: MEMBER })
      otherMember: userOrganization_insert(data: { userId: $other, organizationId: $organizationId, role: MEMBER })
      leaver: userOrganization_insert(data: { userId: $leaver, organizationId: $organizationId, role: MEMBER })
      outsider: userOrganization_insert(data: { userId: $outsider, organizationId: $otherOrganizationId, role: MEMBER })
      fullMember: userOrganization_insert(data: { userId: $member, organizationId: $fullOrganizationId, role: MEMBER })
      timezone: user_update(id: $member, data: { timezone: "Pacific/Auckland" })
      budget: budget_insert(data: { organizationId: $organizationId, currency: EUR, amountMinor: "250000", period: MONTHLY })
    }`,
    { organizationId, otherOrganizationId, fullOrganizationId, ...userIds },
  )

  for (const organization of [organizationId, fullOrganizationId]) {
    const data = await read<{ userOrganization: { createdAt: string } }>(
      `query ReadMembership($organizationId: UUID!, $userId: String!) {
        userOrganization(key: { userId: $userId, organizationId: $organizationId }) { createdAt }
      }`,
      { organizationId: organization, userId: userIds.member },
    )

    memberships[organization] = data.userOrganization.createdAt
  }
}

async function tearDown() {
  await write(
    `mutation TearDown($ids: [UUID!]!, $userIds: [String!]!) {
      organization_deleteMany(where: { id: { in: $ids } })
      user_deleteMany(where: { id: { in: $userIds } })
    }`,
    { ids: [organizationId, otherOrganizationId, fullOrganizationId], userIds: Object.values(userIds) },
  )
}

async function checkReads() {
  const live = await insertBill({ name: 'Live' })
  const deleted = await insertBill({ name: 'Deleted', deletedAt: hoursAgo(1) })
  const budget = await getBudgetForAgent(dataConnect, caller())
  const stale = await getBudgetForAgent(dataConnect, { ...caller(), membershipCreatedAt: STALE })

  check(
    'the budget read answers the membership with its time zone, the budget and the members',
    budget.data.membership[0]?.user.timezone === 'Pacific/Auckland'
      && budget.data.budgets[0]?.currency === Currency.EUR
      && budget.data.budgets[0]?.amountMinor === '250000'
      && budget.data.members.length === 3,
  )
  check(
    'the budget read answers the live bills alone',
    budget.data.bills.some(bill => bill.id === live) && !budget.data.bills.some(bill => bill.id === deleted),
  )
  check(
    'the budget read answers nothing to a membership that ended',
    stale.data.membership.length === 0
      && stale.data.budgets.length === 0
      && stale.data.members.length === 0
      && stale.data.bills.length === 0,
  )

  const bill = await getBillForAgent(dataConnect, { ...caller(), id: deleted })
  const staleBill = await getBillForAgent(dataConnect, { ...caller(), membershipCreatedAt: STALE, id: live })
  const elsewhere = await getBillForAgent(dataConnect, { ...caller(fullOrganizationId), id: live })

  check('a bill read answers a deleted bill with when it went', bill.data.bills[0]?.deletedAt != null)
  check('a bill read answers nothing to a membership that ended', staleBill.data.bills.length === 0)
  check("a bill read answers nothing of another organization's bill", elsewhere.data.bills.length === 0)

  // Years no sync writes, so the rows are this check's alone, written and removed here
  const years = [2991, 2990]
  const rows = [Currency.USD, Currency.GBP].flatMap(currency => years.map(year => ({ currency, year, rates: '{}' })))

  await write(`mutation InsertRates($rows: [ExchangeRateYear_Data!]!) { exchangeRateYear_upsertMany(data: $rows) }`, {
    rows,
  })

  try {
    const { data: rates } = await getExchangeRatesForAgent(dataConnect, {
      currencies: [Currency.USD, Currency.GBP],
      years,
    })

    check(
      'the rates read answers every year asked for, by currency, then year',
      rates.exchangeRateYears.map(({ currency, year }) => `${currency} ${year}`).join(', ')
        === 'GBP 2990, GBP 2991, USD 2990, USD 2991',
    )
  } finally {
    await write(
      `mutation DeleteRates($years: [Int!]!) { exchangeRateYear_deleteMany(where: { year: { in: $years } }) }`,
      {
        years,
      },
    )
  }
}

async function checkIdempotency() {
  const countResults = async () =>
    (
      await read<{ moduleCallResults: unknown[] }>(
        `query CountResults($scope: String!) { moduleCallResults(where: { idempotencyScope: { eq: $scope } }) { tool } }`,
        { scope },
      )
    ).moduleCallResults.length
  const countBills = async () =>
    (
      await read<{ bills: unknown[] }>(
        `query CountBills($organizationId: UUID!) { bills(where: { organizationId: { eq: $organizationId } }) { id } }`,
        { organizationId },
      )
    ).bills.length
  const keyed = (key: string) => ({
    isKeyed: true,
    idempotencyScope: scope,
    idempotencyKey: key,
    tool: 'add_bill',
    argumentsHash: 'hash',
    result: JSON.stringify({ key }),
    expiresAt: null,
  })
  const billsBefore = await countBills()

  await create()

  check('a write without a key inserts no call result, through @include', (await countResults()) === 0)

  await create(keyed('first-key'))

  const stored = await getModuleCallResult(dataConnect, {
    ...caller(),
    idempotencyScope: scope,
    idempotencyKey: 'first-key',
  })

  check(
    'a write with a key inserts its call result, which reads back',
    stored.data.moduleCallResult?.tool === 'add_bill' && stored.data.membership.length === 1,
  )
  check(
    'a write sent again under its key is refused on the key, and writes nothing',
    (await isRefused(create(keyed('first-key')), 'module_call_result_pkey'))
      && (await countBills()) === billsBefore + 2,
  )

  const outcomes = await Promise.all([1, 2, 3].map(() => refusal(create(keyed('racing-key')))))

  check(
    'three writes at once under one key make one write',
    outcomes.filter(outcome => outcome === null).length === 1 && (await countBills()) === billsBefore + 3,
  )
  check(
    'a key past 200 characters is refused',
    await isRefused(create({ ...keyed('k'.repeat(201)) }), 'An idempotency key is 1 to 200 characters'),
  )
}

async function checkCreating() {
  check(
    'a bill the agent adds is written as the module sent it, created by the member it acts as',
    await (async () => {
      const id = createId()

      await createBillForAgent(dataConnect, {
        ...caller(),
        id,
        ...billFields({
          name: 'Notion',
          amountMinor: '1200',
          recurrence: BillRecurrence.MONTHLY,
          endsOn: dayFromToday(300),
        }),
        ...UNKEYED,
      })

      const row = await read<{ bill: { name: string; createdById: string; recurrence: string } | null }>(
        `query ReadCreated($id: UUID!) { bill(id: $id) { name createdById recurrence } }`,
        { id },
      )

      return row.bill?.name === 'Notion' && row.bill.createdById === userIds.member && row.bill.recurrence === 'MONTHLY'
    })(),
  )

  const outcomes = {
    lineBreak: await refusal(create({ name: 'One\nTwo' })),
    spaces: await refusal(create({ company: ' Padded' })),
    description: await refusal(create({ description: 'd'.repeat(141) })),
    zero: await refusal(create({ amountMinor: '0' })),
    tooMuch: await refusal(create({ amountMinor: '1000000000000001' })),
    early: await refusal(create({ paidOn: '1998-12-31' })),
    late: await refusal(create({ paidOn: dayFromToday(3660) })),
    oneTimeEnd: await refusal(create({ endsOn: dayFromToday(10) })),
    endBefore: await refusal(create({ recurrence: BillRecurrence.MONTHLY, endsOn: dayFromToday(-10) })),
    stranger: await refusal(create({ paidById: userIds.outsider })),
    stale: await refusal(create({ membershipCreatedAt: STALE })),
    otherOrganization: await refusal(create({ organizationId: otherOrganizationId })),
  }

  check('a name with a line break is refused', outcomes.lineBreak?.includes("A bill's name and company") ?? false)
  check('a company with a space at an end is refused', outcomes.spaces?.includes("A bill's name and company") ?? false)
  check('a description past 140 characters is refused', outcomes.description?.includes('at most 140') ?? false)
  check('an amount of 0 is refused', outcomes.zero?.includes('1 to 10^15 minor units') ?? false)
  check('an amount past 10^15 is refused', outcomes.tooMuch?.includes('1 to 10^15 minor units') ?? false)
  check('a payment before 1999 is refused', outcomes.early?.includes('from 1999 to ten years ahead') ?? false)
  check('a payment past ten years ahead is refused', outcomes.late?.includes('from 1999 to ten years ahead') ?? false)
  check('an end on a one-time bill is refused', outcomes.oneTimeEnd?.includes('ends only when it recurs') ?? false)
  check('an end before the first payment is refused', outcomes.endBefore?.includes('ends only when it recurs') ?? false)
  check('a payer outside the organization is refused', outcomes.stranger?.includes('paid by a member') ?? false)
  check('a caller whose membership ended is refused', outcomes.stale?.includes('no longer a member') ?? false)
  check(
    'a caller who is no member of the organization named is refused',
    outcomes.otherOrganization?.includes('no longer a member') ?? false,
  )

  const receipts = {
    uploading: await insertReceipt({ status: 'UPLOADING' }),
    elsewhere: await insertReceipt({ organizationId: otherOrganizationId, userId: userIds.outsider }),
    others: await insertReceipt({ userId: userIds.other }),
    old: await insertReceipt({ createdAt: hoursAgo(49) }),
    held: await insertReceipt(),
    fresh: await insertReceipt(),
  }

  await insertBill({ receiptId: receipts.held })

  for (const [name, receiptId] of [
    ['a receipt still uploading', receipts.uploading],
    ["another organization's receipt", receipts.elsewhere],
    ["another member's receipt", receipts.others],
    ['a receipt uploaded over two days ago', receipts.old],
    ['a receipt another bill holds', receipts.held],
  ] as const) {
    check(`${name} is refused`, await isRefused(create({ receiptId }), 'The receipt can no longer be attached'))
  }

  check("the member's fresh receipt is taken", await isAccepted(create({ receiptId: receipts.fresh })))
}

async function checkUpdating() {
  const id = await insertBill({ name: 'Saved', paidById: userIds.leaver })

  check(
    'a save on the updatedAt read goes through',
    await isAccepted(update(id, { name: 'Renamed', paidById: userIds.leaver })),
  )
  check(
    'a save on an updatedAt another save moved is refused',
    await isRefused(
      updateBillForAgent(dataConnect, {
        ...caller(),
        id,
        updatedAt: hoursAgo(1),
        ...billFields({ paidById: userIds.leaver }),
        ...UNKEYED,
      }),
      'deleted or changed elsewhere since it was read',
    ),
  )

  await write(
    `mutation RemoveLeaver($organizationId: UUID!, $userId: String!) {
      userOrganization_delete(key: { userId: $userId, organizationId: $organizationId })
    }`,
    { organizationId, userId: userIds.leaver },
  )

  check(
    'a bill keeps a payer who left the organization',
    await isAccepted(update(id, { name: 'Kept payer', paidById: userIds.leaver })),
  )
  check(
    'a new payer outside the organization is refused',
    await isRefused(update(id, { paidById: userIds.outsider }), 'or by whoever paid it'),
  )
  check(
    'a payer who left is refused on another bill',
    await isRefused(update(await insertBill(), { paidById: userIds.leaver }), 'or by whoever paid it'),
  )

  const own = await insertReceipt({ userId: userIds.other, createdAt: hoursAgo(72) })
  const withReceipt = await insertBill({ receiptId: own })

  check(
    "a bill keeps its own receipt, another member's, uploaded long ago",
    await isAccepted(update(withReceipt, { name: 'Kept receipt', receiptId: own })),
  )
  check(
    'a save with no receipt detaches it',
    (await isAccepted(update(withReceipt, { receiptId: null })))
      && (await readBillRow(withReceipt))?.receiptId === null,
  )

  const taken = await insertReceipt()

  await insertBill({ receiptId: taken })

  check(
    'a receipt another bill holds is refused, by its check or its unique reference',
    ((await refusal(update(withReceipt, { receiptId: taken }))) ?? '').match(
      /bill_receiptId_uidx|The receipt can no longer be attached/,
    ) !== null,
  )
  check(
    'a caller whose membership ended is refused',
    await isRefused(update(id, { membershipCreatedAt: STALE }), 'no longer a member'),
  )
  check(
    'a deleted bill is refused',
    await isRefused(update(await insertBill({ deletedAt: hoursAgo(1) })), 'deleted or changed elsewhere'),
  )
}

async function checkDeletingAndRestoring() {
  const id = await insertBill()
  const remove = (fields: Variables = {}) => deleteBillForAgent(dataConnect, { ...caller(), id, ...UNKEYED, ...fields })
  const restore = (billId = id, fields: Variables = {}) =>
    restoreBillForAgent(dataConnect, { ...caller(), id: billId, ...UNKEYED, ...fields })

  check(
    'a caller whose membership ended deletes nothing',
    await isRefused(remove({ membershipCreatedAt: STALE }), 'no longer a member'),
  )
  check('a live bill is deleted', (await isAccepted(remove())) && (await readBillRow(id))?.deletedAt != null)
  check('a bill deleted already is refused', await isRefused(remove(), 'No bill by that id'))
  check(
    'a caller whose membership ended restores nothing',
    await isRefused(restore(id, { membershipCreatedAt: STALE }), 'no longer a member'),
  )
  check(
    'a bill deleted within a day is restored',
    (await isAccepted(restore())) && (await readBillRow(id))?.deletedAt === null,
  )
  check('a bill not deleted is refused', await isRefused(restore(), 'gone for good'))

  const old = await insertBill({ deletedAt: hoursAgo(25) })

  check('a bill deleted over a day ago is refused', await isRefused(restore(old), 'gone for good'))
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

  const createFull = () => create({ ...caller(fullOrganizationId) })

  check(`the ${MAX_BILLS}th bill is taken`, await isAccepted(createFull()))
  check(`the ${MAX_BILLS + 1}st is refused`, await isRefused(createFull(), `at most ${MAX_BILLS} bills`))
  check(
    'a restore at the cap is refused',
    await isRefused(
      restoreBillForAgent(dataConnect, { ...caller(fullOrganizationId), id: deleted, ...UNKEYED }),
      `at most ${MAX_BILLS} bills`,
    ),
  )
  check(
    'the budget read answers every bill at the cap',
    (await getBudgetForAgent(dataConnect, caller(fullOrganizationId))).data.bills.length === MAX_BILLS,
  )
}

async function checkReserving() {
  const reserve = (fields: Variables = {}) => {
    const receiptId = createId()

    return {
      receiptId,
      reserved: reserveBillReceiptForAgent(dataConnect, {
        ...caller(),
        receiptId,
        name: 'Invoice.pdf',
        contentType: 'application/pdf',
        size: 1000,
        ...fields,
      }),
    }
  }
  const { receiptId, reserved } = reserve()

  check(
    'a receipt is reserved for the member, uploading',
    (await isAccepted(reserved)) && (await readReceiptRow(receiptId))?.status === 'UPLOADING',
  )
  check(
    'it turns ready once its file is stored',
    (await isAccepted(completeBillReceiptUpload(dataConnect, { organizationId, userId: userIds.member, receiptId })))
      && (await readReceiptRow(receiptId))?.status === 'READY',
  )
  check(
    `a receipt past ${MAX_AGENT_BILL_RECEIPT_SIZE} bytes is refused`,
    await isRefused(reserve({ size: MAX_AGENT_BILL_RECEIPT_SIZE + 1 }).reserved, 'at most 700 KiB'),
  )
  check(
    `a receipt of ${MAX_AGENT_BILL_RECEIPT_SIZE} bytes is taken`,
    await isAccepted(reserve({ size: MAX_AGENT_BILL_RECEIPT_SIZE }).reserved),
  )
  check(
    'a name with a line break is refused',
    await isRefused(reserve({ name: 'One\nTwo' }).reserved, 'at most 700 KiB'),
  )
  check(
    'a type a bill takes no receipt of is refused',
    await isRefused(reserve({ contentType: 'image/gif' }).reserved, 'at most 700 KiB'),
  )
  check(
    'a caller whose membership ended reserves nothing',
    await isRefused(reserve({ membershipCreatedAt: STALE }).reserved, 'no longer a member'),
  )
}

// A file of a conversation's, as an upload stores one, sent by a message or waiting in a draft
async function insertFile(conversationId: string, messageId: string | null, fields: Variables = {}) {
  const id = createId()

  await write(
    `mutation InsertFile($data: ConversationAttachment_Data!) { conversationAttachment_insert(data: $data) }`,
    {
      data: {
        id,
        userId: userIds.member,
        organizationId,
        conversationId,
        messageId,
        status: 'READY',
        name: 'Invoice.pdf',
        contentType: 'application/pdf',
        size: 2000,
        pageCount: 1,
        tokenCount: 1594,
        claudeFileId: `file_${id}`,
        ...fields,
      },
    },
  )

  return id
}

async function checkAttachmentReceipts() {
  const { membershipCreatedAt } = caller()
  const parent = { conversationId: createId(), runId: createId(), messageId: createId() }
  const fence = { organizationId, userId: userIds.member, conversationId: parent.conversationId, runId: parent.runId }

  // A conversation of the member's whose run ended, as one is between messages
  await startConversation(dataConnect, {
    ...fence,
    membershipCreatedAt,
    messageId: parent.messageId,
    title: 'Checked conversation',
    text: 'Add this invoice',
    preview: { kind: 'MEMBER_TEXT', text: 'Add this invoice' },
    content: JSON.stringify([{ type: 'text', text: 'Add this invoice' }]),
    aspects: [CompanyAspect.FINANCES],
    aspectsSetBy: ConversationActor.MEMBER,
    isUsageCapped: false,
  })
  await claimQueuedConversationRun(dataConnect, { ...fence, attempts: 0, membershipCreatedAt })
  await finishConversationRun(dataConnect, {
    ...fence,
    attempts: 1,
    membershipCreatedAt,
    status: ConversationRunStatus.COMPLETED,
  })

  const sent = await insertFile(parent.conversationId, parent.messageId)
  const kept = await insertFile(parent.conversationId, parent.messageId, { name: 'Kept.pdf' })
  const drafted = await insertFile(parent.conversationId, null)
  const others = await insertFile(parent.conversationId, parent.messageId, { userId: userIds.other })
  const gif = await insertFile(parent.conversationId, parent.messageId, {
    name: 'receipt.gif',
    contentType: 'image/gif',
  })
  const subagent = { conversationId: createId(), runId: createId(), messageId: createId() }

  await launchSubagent(dataConnect, {
    organizationId,
    userId: userIds.member,
    membershipCreatedAt,
    parentId: parent.conversationId,
    anchorPosition: 0,
    launchRunId: null,
    launchToolUseId: null,
    ...subagent,
    title: 'Checked subagent',
    text: 'Add the invoice as a bill',
    content: JSON.stringify([{ type: 'text', text: 'Add the invoice as a bill' }]),
    attachmentIds: [sent],
    isUsageCapped: false,
  })

  const read = async (conversationId: string, attachmentId: string, fields: Variables = {}) =>
    (await getConversationAttachmentForAgent(dataConnect, { ...caller(), conversationId, attachmentId, ...fields }))
      .data
  const own = await read(parent.conversationId, sent)
  const fromSubagent = await read(subagent.conversationId, sent)

  check(
    'the read finds a file the member sent, its conversation the one calling, with its pages',
    own.membership.length === 1
      && own.conversations[0]?.parentId == null
      && own.attachments[0]?.conversationId === parent.conversationId
      && own.attachments[0]?.pageCount === 1,
  )
  check(
    "it finds no file waiting in a draft, nor another member's",
    (await read(parent.conversationId, drafted)).attachments.length === 0
      && (await read(parent.conversationId, others)).attachments.length === 0,
  )
  check(
    "a subagent's read names its parent and the files its brief lists",
    fromSubagent.conversations[0]?.parentId === parent.conversationId
      && JSON.stringify(fromSubagent.conversations[0]?.briefs[0]?.attachmentIds) === JSON.stringify([sent])
      && fromSubagent.attachments[0]?.conversationId === parent.conversationId,
  )
  check(
    "the parent's own conversation has no brief",
    own.conversations[0]?.briefs.length === 0 && (await read(parent.conversationId, kept)).attachments.length === 1,
  )
  check(
    'a caller whose membership ended reads no membership',
    (await read(parent.conversationId, sent, { membershipCreatedAt: STALE })).membership.length === 0,
  )

  const reserve = (fields: Variables = {}) => {
    const receiptId = createId()

    return {
      receiptId,
      reserved: reserveAttachmentBillReceiptForAgent(dataConnect, {
        ...caller(),
        receiptId,
        conversationId: parent.conversationId,
        attachmentId: sent,
        name: 'Invoice.pdf',
        contentType: 'application/pdf',
        size: 2000,
        ...fields,
      }),
    }
  }
  const { receiptId, reserved } = reserve()
  const notSent = 'not one the member sent'

  check(
    "a receipt is reserved from the member's sent file, uploading",
    (await isAccepted(reserved)) && (await readReceiptRow(receiptId))?.status === 'UPLOADING',
  )
  check(
    'once its copy is stored, a bill takes it',
    (await isAccepted(completeBillReceiptUpload(dataConnect, { organizationId, userId: userIds.member, receiptId })))
      && (await isAccepted(create({ receiptId }))),
  )
  check(
    'a file waiting in a draft reserves nothing',
    await isRefused(reserve({ attachmentId: drafted }).reserved, notSent),
  )
  check(
    'a file of another conversation reserves nothing',
    await isRefused(reserve({ conversationId: subagent.conversationId }).reserved, notSent),
  )
  check("another member's file reserves nothing", await isRefused(reserve({ attachmentId: others }).reserved, notSent))
  check(
    "a name, a type or a size other than the file's reserves nothing",
    (await isRefused(reserve({ name: 'Other.pdf' }).reserved, notSent))
      && (await isRefused(reserve({ contentType: 'text/plain' }).reserved, notSent))
      && (await isRefused(reserve({ size: 2001 }).reserved, notSent)),
  )
  check(
    'a GIF, which no receipt comes as, is refused',
    await isRefused(
      reserve({ attachmentId: gif, name: 'receipt.gif', contentType: 'image/gif' }).reserved,
      'at most 10 MiB',
    ),
  )
  check(
    `a receipt past ${MAX_BILL_RECEIPT_SIZE} bytes is refused`,
    await isRefused(reserve({ size: MAX_BILL_RECEIPT_SIZE + 1 }).reserved, 'at most 10 MiB'),
  )
  check(
    'a caller whose membership ended reserves nothing',
    await isRefused(reserve({ membershipCreatedAt: STALE }).reserved, 'no longer a member'),
  )
}

try {
  await setUp()
  await checkReads()
  await checkIdempotency()
  await checkCreating()
  await checkUpdating()
  await checkDeletingAndRestoring()
  await checkCap()
  await checkReserving()
  await checkAttachmentReceipts()
} finally {
  await tearDown()
}

if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  process.exit(1)
}

console.log('\nEvery check passed')

process.exit(0)
