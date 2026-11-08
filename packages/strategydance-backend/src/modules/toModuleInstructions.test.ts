import { describe, expect, it } from 'bun:test'

import { MODULES } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import toModuleInstructions from './toModuleInstructions'

// An external agent with every scope, its connection reaching two organizations
const EXTERNAL: ModuleAccess = {
  kind: 'external',
  userId: 'member',
  scopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
  idempotencyScope: 'connection:checked',
  organizations: [
    {
      organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
      membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
      segment: 'acme-ab12',
      name: 'Acme',
    },
    {
      organizationId: '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b',
      membershipCreatedAt: '2026-10-10T10:00:00.000000Z',
      segment: '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b',
      name: 'Beta',
    },
  ],
}

// Strategy Dance's agent, with every scope, in its run's organization
const AGENT: ModuleAccess = {
  kind: 'agent',
  userId: 'member',
  scopes: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
  idempotencyScope: 'conversation:checked',
  organization: {
    organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
    membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
  },
}

const IDEMPOTENCY = 'Every write tool takes an idempotency key'
const REACHED = 'This connection reaches'

// How many times a text holds a part
function count(text: string, part: string) {
  return text.split(part).length - 1
}

describe('toModuleInstructions', () => {
  it('says what Strategy Dance is, the key and the organizations once on a server of several, between which each module listed says what it holds', () => {
    const instructions = toModuleInstructions(['documents', 'tasks', 'budget'], EXTERNAL)

    expect(instructions).toStartWith(
      "Strategy Dance accompanies a company's team as it builds, sells and runs the company. This server holds Strategy Dance's Documents, Tasks and Budget modules, and you act as one member of the organization in each.\n\nThe Documents module holds the organization's documents: ",
    )
    expect(count(instructions, 'Strategy Dance accompanies')).toBe(1)
    expect(count(instructions, 'You act as one member')).toBe(0)
    expect(count(instructions, 'This server ')).toBe(1)
    expect(instructions).toContain("\n\nThe Tasks module is the organization's task board: ")
    expect(instructions).toContain("\n\nThe Budget module is the organization's budget: ")
    expect(instructions.indexOf('The Tasks module')).toBeGreaterThan(instructions.indexOf('The Documents module'))
    expect(instructions.indexOf('The Budget module')).toBeGreaterThan(instructions.indexOf('The Tasks module'))
    expect(count(instructions, IDEMPOTENCY)).toBe(1)
    expect(count(instructions, REACHED)).toBe(1)
    expect(instructions.indexOf(REACHED)).toBeGreaterThan(instructions.indexOf(IDEMPOTENCY))
    expect(instructions).toEndWith('ask them rather than choose.')
  })

  it('lists the modules in `MODULES`’ order, as the server lists their tools, whatever the order given', () => {
    expect(toModuleInstructions(['budget', 'tasks', 'documents'], EXTERNAL)).toBe(
      toModuleInstructions(['documents', 'tasks', 'budget'], EXTERNAL),
    )
  })

  it('names each tool a mention opens as this server’s, beside the modules listed', () => {
    const instructions = toModuleInstructions(['documents', 'tasks'], EXTERNAL)

    expect(count(instructions, 'which read_document or read_task opens')).toBe(2)
    expect(instructions).not.toContain("the task board's read_task")
    expect(instructions).not.toContain("the Documents module's read_document")
    expect(instructions).not.toContain("this server's read_task")
  })

  it('never names a module the server does not list', () => {
    const withoutTasks = toModuleInstructions(['documents', 'budget'], EXTERNAL)
    const withoutDocuments = toModuleInstructions(['tasks', 'budget'], EXTERNAL)
    const withoutBudget = toModuleInstructions(['documents', 'tasks'], EXTERNAL)

    expect(withoutTasks).toContain("which read_document opens when it is a document's")
    expect(withoutTasks).not.toContain('read_task')
    expect(withoutTasks).not.toMatch(/task board|Tasks/)
    expect(withoutDocuments).toContain("which read_task opens when it is a task's")
    expect(withoutDocuments).not.toContain('read_document')
    expect(withoutDocuments).not.toContain('Documents')
    expect(withoutBudget).not.toMatch(/budget|bill/i)
  })

  it('says a module listed alone on a server of several is its one module, worded as beside none', () => {
    const instructions = toModuleInstructions(['documents'], EXTERNAL)

    expect(instructions).toStartWith(
      "Strategy Dance accompanies a company's team as it builds, sells and runs the company. This server holds Strategy Dance's Documents module, and you act as one member of the organization in it.\n\nThe Documents module holds ",
    )
    expect(instructions).toContain("which read_document opens when it is a document's")
    expect(instructions).not.toContain('read_task')
  })

  it('keeps a module’s own words on a server of that module alone, naming the others’ tools', () => {
    const documents = toModuleInstructions('documents', EXTERNAL)
    const tasks = toModuleInstructions('tasks', EXTERNAL)

    expect(documents).toStartWith(
      "Strategy Dance accompanies a company's team as it builds, sells and runs the company. This server holds the organization's documents: ",
    )
    expect(documents).toContain("which read_document or the task board's read_task opens")
    expect(tasks).toContain("which the Documents module's read_document or this server's read_task opens")
  })

  it('tells Strategy Dance’s agent no organization, and what it acts as through Subagents and Knowledge', () => {
    const instructions = toModuleInstructions(
      MODULES.map(({ name }) => name),
      AGENT,
    )

    expect(instructions).not.toContain(REACHED)
    expect(count(instructions, IDEMPOTENCY)).toBe(1)
    expect(instructions).toContain(
      "This server holds Strategy Dance's Documents, Tasks, Budget, Subagents and Knowledge modules",
    )
    expect(instructions).toContain(
      'with a report. You act as one member of the organization, from one of their conversations',
    )
    expect(instructions).toContain(
      'can be submitted to. You act as one member of the organization, and keep what the company uses',
    )
  })

  it('says the key only where a served module is listed, as Knowledge’s and Subagents’ servers never did', () => {
    expect(toModuleInstructions('knowledge', AGENT)).not.toContain(IDEMPOTENCY)
    expect(toModuleInstructions(['subagents', 'knowledge'], AGENT)).not.toContain(IDEMPOTENCY)
    expect(toModuleInstructions('budget', AGENT)).toContain(IDEMPOTENCY)
  })
})
