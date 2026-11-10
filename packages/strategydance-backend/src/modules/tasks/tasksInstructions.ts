import type { ModuleName } from 'strategydance-core'

import type { ModuleInstructions } from '~types'

// What opens a mention, on the Tasks module's server alone or beside the modules listed
function toMentionOpener(listed: readonly ModuleName[] | null) {
  if (!listed) return "the Documents module's read_document or this server's read_task opens"

  return listed.includes('documents') ? 'read_document or read_task opens' : "read_task opens when it is a task's"
}

// What the Tasks module tells an agent: what the board holds and how it is read, and how to write
// to it safely
const TASKS_INSTRUCTIONS: ModuleInstructions = {
  label: 'Tasks',
  holds:
    "is the organization's task board: the team's tasks, each in one of four columns, in its own order, BACKLOG for ideas nobody agreed to yet, TODO for agreed work, ONGOING for work under way, and DONE.",
  paragraphs: listed => [
    `A task has a one-line name, a description that is a short brief in Markdown (headings, quotes, lists and check lists, where a link to doc:<id> or task:<id> is a mention of the document or the task with that id, which ${toMentionOpener(listed)}, and one to conversation:<id> a mention of one of the team's conversations with Strategy Dance, which no tool opens), at most one assignee, a member or Strategy Dance itself, a due date, and the aspects of the company it is about, among STRATEGY, PEOPLE, FINANCES, PRODUCT, ENGINEERING, DESIGN, MARKETING, SALES and LEGAL. A task can wait on others, and is blocked until they are done. A task assigned to Strategy Dance is one the team expects Strategy Dance's own agent to take up.`,
    "The board is the team's: any member reads and changes any task, and members move and edit tasks while you do. Read a task before you change its description, and change only the fields you mean to.",
  ],
}

export default TASKS_INSTRUCTIONS
