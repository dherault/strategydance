import type { ModuleCaller } from '~types'

import type { FakeBill } from '~domain/budget/testing/createBudgetDatabaseFake'
import type { ModuleDatabaseFake } from '~domain/modules/testing/createModuleDatabaseFake'

import createModuleTestKit from '~modules/testing/createModuleTestKit'

// The prototype's seed bills, as strategydance-core's tests hold its computations to them, in cents
const SEED_BILLS: Partial<FakeBill>[] = [
  { name: 'Claude Team plan', company: 'Anthropic', amountMinor: 15000, paidOn: '2025-12-03', recurrence: 'MONTHLY' },
  {
    name: 'Cloud hosting',
    company: 'Amazon Web Services',
    amountMinor: 31240,
    paidOn: '2026-02-01',
    recurrence: 'MONTHLY',
  },
  { name: 'Vercel Pro', company: 'Vercel', amountMinor: 2000, paidOn: '2025-08-12', recurrence: 'MONTHLY' },
  { name: 'Google Workspace', company: 'Google', amountMinor: 4200, paidOn: '2025-02-05', recurrence: 'MONTHLY' },
  { name: 'Figma Professional', company: 'Figma', amountMinor: 3000, paidOn: '2026-01-21', recurrence: 'MONTHLY' },
  {
    name: 'Design retainer',
    company: 'Léa Dubois Studio',
    amountMinor: 120000,
    currency: 'EUR',
    paidOn: '2026-04-28',
    recurrence: 'MONTHLY',
  },
  {
    name: 'Coworking desk',
    company: 'Morning Coworking',
    amountMinor: 34000,
    currency: 'EUR',
    paidOn: '2025-10-01',
    recurrence: 'MONTHLY',
  },
  {
    name: 'Accounting',
    company: 'Fiducial Expertise',
    amountMinor: 90000,
    currency: 'EUR',
    paidOn: '2026-01-15',
    recurrence: 'QUARTERLY',
  },
  { name: 'Apple Developer Program', company: 'Apple', amountMinor: 9900, paidOn: '2025-03-02', recurrence: 'YEARLY' },
  { name: 'Domain renewal', company: 'Namecheap', amountMinor: 1498, paidOn: '2024-11-08', recurrence: 'YEARLY' },
  {
    name: 'Liability insurance',
    company: 'Hiscox',
    amountMinor: 48000,
    currency: 'EUR',
    paidOn: '2025-12-10',
    recurrence: 'YEARLY',
  },
  { name: 'Newsletter', company: 'Beehiiv', amountMinor: 4900, paidOn: '2026-06-09', recurrence: 'MONTHLY' },
  { name: 'Launch ads', company: 'X', amountMinor: 40000, paidOn: '2026-10-06' },
  { name: 'User interviews', company: 'Respondent', amountMinor: 36000, paidOn: '2026-10-15' },
  { name: 'Sponsored posts', company: 'LinkedIn', amountMinor: 30000, paidOn: '2026-09-24' },
  { name: 'Conference ticket', company: 'Station F', amountMinor: 25000, currency: 'EUR', paidOn: '2026-09-09' },
  { name: 'Stock photos', company: 'Unsplash', amountMinor: 9600, paidOn: '2026-08-05' },
  { name: 'MacBook Air', company: 'Apple', amountMinor: 149900, paidOn: '2026-06-21' },
  { name: 'Contract review', company: 'Captain Contrat', amountMinor: 39000, currency: 'EUR', paidOn: '2026-04-02' },
]

// The day the prototype's seed computes on, whose rates make the dollar 0.92 euro
export const SEED_TODAY = '2026-10-19'

// A budget's bills for the Budget module's tests, and the module as a member's agent reaches it
function createBudgetTestBills(fake: ModuleDatabaseFake, organizationId: string) {
  // The module as a member's agent reaches it, every scope unless told otherwise
  function connect(fields: Partial<ModuleCaller> = {}, userId = 'member') {
    return createModuleTestKit('budget', {
      kind: 'agent',
      userId,
      organizationId,
      membershipCreatedAt: fake.addMember(userId, organizationId, { displayName: 'Ada' }),
      scopes: ['budget:read', 'budget:write'],
      idempotencyScope: 'conversation:checked',
      ...fields,
    })
  }

  function add(fields: Partial<FakeBill> = {}) {
    return fake.insertBill({ organizationId, paidById: 'member', ...fields })
  }

  // The prototype's 19 bills, its $2,500 a month, and the dollar at 1/0.92 euro on its today
  function seed() {
    fake.setBudget(organizationId, { currency: 'USD', amountMinor: 250000, period: 'MONTHLY' })
    fake.insertRates('USD', 2026, { [SEED_TODAY]: 1 / 0.92 })

    return SEED_BILLS.map(fields => add(fields))
  }

  return { connect, add, seed }
}

export default createBudgetTestBills
