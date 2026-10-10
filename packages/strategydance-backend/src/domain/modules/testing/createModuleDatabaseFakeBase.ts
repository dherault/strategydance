import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  What every module's database fake shares: the memberships and organizations a caller is checked
  against, the module call results kept under their idempotency keys, the operations that read and
  prune those, and the SDK the tests mock `strategydance-database/backend` with. Each module's fake
  adds its own tables and operations to one base, as `createModuleDatabaseFake` puts them together:
  a module's handler loads every module's server, whose imports all resolve against the one mock,
  and Bun refuses an import the mock does not hold.

  An operation checks everything before it changes anything, so it applies whole or not at all, as
  a transaction does, and runs without yielding, so two called at once take turns as two locked
  transactions do. `beforeOperation` runs first, which is where a test lets something happen
  meanwhile. Times are the clock's, which a test moves with `setSystemTime`. Ids are kept as Data
  Connect keeps them, dashless
*/

export const CompanyAspect = {
  STRATEGY: 'STRATEGY',
  PEOPLE: 'PEOPLE',
  FINANCES: 'FINANCES',
  PRODUCT: 'PRODUCT',
  ENGINEERING: 'ENGINEERING',
  DESIGN: 'DESIGN',
  MARKETING: 'MARKETING',
  SALES: 'SALES',
  LEGAL: 'LEGAL',
} as const

export const TaskStatus = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  ONGOING: 'ONGOING',
  DONE: 'DONE',
} as const

export type FakeModuleCallResult = {
  idempotencyScope: string
  idempotencyKey: string
  userId: string
  organizationId: string
  tool: string
  argumentsHash: string
  result: string
  expiresAt: string | null
  createdAt: string
}

export type FakeMembership = {
  createdAt: string
  displayName: string | null
}

type Variables = Record<string, unknown>

// What a test reads the variables of an operation as
export type AnyVariables = Record<string, any>

export type FakeOperation = (variables: AnyVariables) => unknown

function createModuleDatabaseFakeBase() {
  const memberships = new Map<string, FakeMembership>()
  const organizations = new Map<string, { slug: string | null }>()
  const results = new Map<string, FakeModuleCallResult>()
  // Every operation called, by name, in order
  const calls: string[] = []
  // What each module's fake empties on a reset, besides the tables here
  const resets: (() => void)[] = []
  let stamps = 0

  const fake = {
    memberships,
    organizations,
    results,
    calls,
    beforeOperation: async (_name: string, _variables: AnyVariables): Promise<void> => {},
  }

  function now() {
    return new Date().toISOString()
  }

  // A time no other stamp shares, to the microsecond, as Postgres keeps one
  function stamp() {
    stamps++

    return now().replace('Z', `${String(stamps % 1000).padStart(3, '0')}Z`)
  }

  function id(value: unknown) {
    return toCanonicalUuid(String(value))
  }

  function membershipKey(userId: unknown, organizationId: unknown) {
    return `${userId}:${id(organizationId)}`
  }

  function resultKey(scope: unknown, key: unknown) {
    return `${scope}\n${key}`
  }

  function refuse(message: string): never {
    throw new Error(message)
  }

  function addMember(
    userId: string,
    organizationId: string,
    { slug = null, displayName = null }: { slug?: string | null; displayName?: string | null } = {},
  ) {
    if (!organizations.has(id(organizationId))) organizations.set(id(organizationId), { slug })

    const createdAt = stamp()

    memberships.set(membershipKey(userId, organizationId), { createdAt, displayName })

    return createdAt
  }

  function removeMember(userId: string, organizationId: string) {
    memberships.delete(membershipKey(userId, organizationId))
  }

  // Whether the caller is still the member the module read, as each operation matches the
  // membership on its `createdAt`
  function isMember(variables: AnyVariables) {
    return (
      memberships.get(membershipKey(variables.userId, variables.organizationId))?.createdAt
      === variables.membershipCreatedAt
    )
  }

  // The members of an organization, by when they joined, as the operations that list them read them
  function membersOf(organizationId: unknown) {
    const suffix = `:${id(organizationId)}`

    return [...memberships.entries()]
      .filter(([key]) => key.endsWith(suffix))
      .map(([key, membership]) => ({ userId: key.slice(0, -suffix.length), ...membership }))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.userId < b.userId ? -1 : 1))
  }

  // The membership a read answers beside its rows, so a caller who is no longer the member is refused
  function membershipOf(variables: AnyVariables) {
    return isMember(variables) ? [{ userId: variables.userId }] : []
  }

  // The key's insert every write makes first when its call carries one
  function insertResult(variables: AnyVariables) {
    if (!variables.isKeyed) return

    if (results.has(resultKey(variables.idempotencyScope, variables.idempotencyKey))) {
      refuse('violates SQL unique constraint: module_call_result_pkey (aborted)')
    }
  }

  function storeResult(variables: AnyVariables) {
    if (!variables.isKeyed) return

    results.set(resultKey(variables.idempotencyScope, variables.idempotencyKey), {
      idempotencyScope: String(variables.idempotencyScope),
      idempotencyKey: String(variables.idempotencyKey),
      userId: String(variables.userId),
      organizationId: id(variables.organizationId),
      tool: String(variables.tool),
      argumentsHash: String(variables.argumentsHash),
      result: String(variables.result),
      expiresAt: (variables.expiresAt as string | null | undefined) ?? null,
      createdAt: now(),
    })
  }

  function checkKey(variables: AnyVariables) {
    if (variables.isKeyed && !(variables.idempotencyKey.length >= 1 && variables.idempotencyKey.length <= 200)) {
      refuse('An idempotency key is 1 to 200 characters')
    }
  }

  // The generated SDK's names, `getModuleCallResult(dataConnect, variables)` for
  // `GetModuleCallResult`, with the enums it exports
  const sdk: Record<string, unknown> = { CompanyAspect, TaskStatus }

  // Adds a module's operations to the SDK, each recorded as it is called and run after
  // `beforeOperation`
  function addOperations(operations: Record<string, FakeOperation>) {
    for (const [name, operation] of Object.entries(operations)) {
      sdk[name.charAt(0).toLowerCase() + name.slice(1)] = async (_dataConnect: unknown, variables: Variables = {}) => {
        calls.push(name)

        await fake.beforeOperation(name, variables)

        return { data: operation(variables) }
      }
    }
  }

  // Empties a module's own tables along with these on every reset
  function onReset(reset: () => void) {
    resets.push(reset)
  }

  addOperations({
    GetOrganizationForAgent: variables => {
      const organization = organizations.get(id(variables.organizationId))

      return { organization: organization ? { id: id(variables.organizationId), slug: organization.slug } : null }
    },

    GetModuleCallResult: variables => {
      const stored = results.get(resultKey(variables.idempotencyScope, variables.idempotencyKey))

      return { membership: membershipOf(variables), moduleCallResult: stored ?? null }
    },

    DeleteExpiredModuleCallResults: () => {
      let deleted = 0

      for (const [key, stored] of results) {
        if (stored.expiresAt !== null && Date.parse(stored.expiresAt) < Date.now()) {
          results.delete(key)
          deleted++
        }
      }

      return { moduleCallResult_deleteMany: deleted }
    },
  })

  // Empties every table, for the next test
  function reset() {
    for (const table of [memberships, organizations, results]) table.clear()
    for (const resetModule of resets) resetModule()

    calls.length = 0
    fake.beforeOperation = async () => {}
  }

  return Object.assign(fake, {
    sdk,
    now,
    stamp,
    id,
    refuse,
    addMember,
    removeMember,
    isMember,
    membersOf,
    membershipOf,
    insertResult,
    storeResult,
    checkKey,
    addOperations,
    onReset,
    reset,
  })
}

export type ModuleDatabaseFakeBase = ReturnType<typeof createModuleDatabaseFakeBase>

export default createModuleDatabaseFakeBase
