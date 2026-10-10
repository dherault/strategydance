import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleCaller } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import createModuleAddresses from '~modules/createModuleAddresses'
import tasksModule from '~modules/tasks/tasksModule'
import TASKS_TOOLS from '~modules/tasks/tasksTools'

// What the server tells an agent before it calls anything: what Strategy Dance is, what the board
// holds and how it is read, and how to write to it safely
const INSTRUCTIONS = `Strategy Dance accompanies a company's team as it builds, sells and runs the company. This server is the organization's task board: the team's tasks, each in one of four columns, in its own order, BACKLOG for ideas nobody agreed to yet, TODO for agreed work, ONGOING for work under way, and DONE. You act as one member of the organization.

A task has a one-line name, a description that is a short brief in Markdown (headings, quotes, lists and check lists), at most one assignee, a member or Strategy Dance itself, a due date, and the aspects of the company it is about, among STRATEGY, PEOPLE, FINANCES, PRODUCT, ENGINEERING, DESIGN, MARKETING, SALES and LEGAL. A task can wait on others, and is blocked until they are done. A task assigned to Strategy Dance is one the team expects Strategy Dance's own agent to take up.

The board is the team's: any member reads and changes any task, and members move and edit tasks while you do. Read a task before you change its description, and change only the fields you mean to.

Every write tool takes an idempotency key in the call's _meta, under "${MODULE_IDEMPOTENCY_KEY_META}": send a new one with each write, and the same one when you send the same write again after losing its answer. A write sent again without a key can be applied twice.`

// The Tasks module's MCP server, built for one caller, whom every tool acts as
function createTasksServer(caller: ModuleCaller) {
  const server = new McpServer(
    { name: 'strategydance-tasks', title: tasksModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  )
  const context = { caller, toAddress: createModuleAddresses(caller, 'tasks') }

  for (const register of TASKS_TOOLS) register(server, context)

  return server
}

export default createTasksServer
