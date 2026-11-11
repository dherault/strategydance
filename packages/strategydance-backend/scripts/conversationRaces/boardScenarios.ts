import { MAX_TASKS } from 'strategydance-core'
import { TaskStatus } from 'strategydance-database/backend'

import addTaskDependency from '~domain/tasks/addTaskDependency'
import createTask from '~domain/tasks/createTask'

import { type Member, asAgent, asMember, createId, createTeam, insertRows, read } from './raceFixtures'
import { JITTERS, type RaceScenario, describe, race } from './raceHarness'

// Who writes, in turn: the page twice, the page and the agent, the agent twice
const WRITERS: ('page' | 'agent')[][] = [
  ['page', 'page'],
  ['page', 'agent'],
  ['agent', 'agent'],
]

// The writers of a round, each pair going through every jitter in turn
function readWriters(round: number) {
  return WRITERS[Math.floor((round - 1) / JITTERS.length) % WRITERS.length]!
}

// Tasks on the member's board, the first `count` of them named, as admin rows
async function fillBoard(member: Member, count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: createId(),
    organizationId: member.organizationId,
    createdById: member.userId,
    name: `Raced task ${index + 1}`,
    description: '',
    descriptionText: '',
    status: 'TODO',
    position: index + 1,
  }))

  await insertRows('Task', rows)

  return rows.map(({ id }) => id)
}

// Makes a task wait on another as the board's picker does, or as the Tasks module does, an
// agent's refusal thrown as the page's is
async function link(member: Member, writer: 'page' | 'agent', taskId: string, dependencyId: string) {
  if (writer === 'page') {
    return asMember(member).run('AddTaskDependency', { organizationId: member.organizationId, taskId, dependencyId })
  }

  const linked = await addTaskDependency(asAgent(member), { id: taskId, dependsOnId: dependencyId }, null)

  if (linked.outcome !== 'written') throw new Error(`The agent was answered ${linked.outcome}`)

  return linked
}

async function readLinks(organizationId: string) {
  const data = await read<{ taskDependencies: { taskId: string; dependencyId: string }[] }>(
    `query ReadLinks($organizationId: UUID!) {
      taskDependencies(where: { task: { organizationId: { eq: $organizationId } } }) { taskId dependencyId }
    }`,
    { organizationId },
  )

  return data.taskDependencies
}

/*
  Two links between two tasks at once, one each way, which would leave both waiting on each other,
  blocked for good, were both to go through: a task never waits on one that waits on it
*/
const linksBothWays: RaceScenario = {
  name: 'links-both-ways',
  description: 'two links between two tasks, one each way, link them one way',
  async run({ round, jitter, expect }) {
    const {
      members: [member],
    } = await createTeam('links-both-ways', round, ['MEMBER'])
    const [first, second] = await fillBoard(member!, 2)
    const [firstWriter, secondWriter] = readWriters(round)
    const results = await race<unknown>(
      {
        [`${firstWriter} links one way`]: () => link(member!, firstWriter!, first!, second!),
        [`${secondWriter} links the other`]: () => link(member!, secondWriter!, second!, first!),
      },
      jitter,
    )
    const passed = Object.values(results).filter(({ status }) => status === 'fulfilled').length
    const links = await readLinks(member!.organizationId)

    expect(
      'one of the two goes through',
      passed === 1,
      Object.entries(results)
        .map(([writer, result]) => `${writer} ${describe(result)}`)
        .join(', '),
    )
    expect('the tasks are linked one way', links.length === 1, `${links.length} links`)
  },
}

// Adds a task as a column's + does, or as the Tasks module does, an agent's refusal thrown
async function add(member: Member, writer: 'page' | 'agent') {
  if (writer === 'page') {
    return asMember(member).run('CreateTaskWithText', {
      organizationId: member.organizationId,
      id: createId(),
      name: 'Raced task',
      description: '',
      descriptionText: '',
      status: 'TODO',
      position: MAX_TASKS + 1,
      assigneeId: null,
      isAssignedToAgent: false,
      dueDate: null,
      aspects: [],
    })
  }

  const created = await createTask(asAgent(member), { name: 'Raced task', status: TaskStatus.TODO }, null)

  if (created.outcome !== 'written') throw new Error(`The agent was answered ${created.outcome}`)

  return created
}

async function countLiveTasks(organizationId: string) {
  const data = await read<{ tasks: { id: string }[] }>(
    `query CountLiveTasks($organizationId: UUID!) {
      tasks(where: { organizationId: { eq: $organizationId }, deletedAt: { isNull: true } }, limit: 2000) { id }
    }`,
    { organizationId },
  )

  return data.tasks.length
}

// Two tasks added at once to a board one short of the tasks an organization keeps
const addsPastTheCap: RaceScenario = {
  name: 'adds-past-the-cap',
  description: `two tasks added to a board of ${MAX_TASKS - 1} leave ${MAX_TASKS}, the most it keeps`,
  async run({ round, jitter, expect }) {
    const {
      members: [member],
    } = await createTeam('adds-past-the-cap', round, ['MEMBER'])

    await fillBoard(member!, MAX_TASKS - 1)

    const [firstWriter, secondWriter] = readWriters(round)
    const results = await race<unknown>(
      {
        [`${firstWriter} adds`]: () => add(member!, firstWriter!),
        [`${secondWriter} adds too`]: () => add(member!, secondWriter!),
      },
      jitter,
    )
    const passed = Object.values(results).filter(({ status }) => status === 'fulfilled').length
    const count = await countLiveTasks(member!.organizationId)

    expect(
      'one of the two goes through',
      passed === 1,
      Object.entries(results)
        .map(([writer, result]) => `${writer} ${describe(result)}`)
        .join(', '),
    )
    expect(`the board keeps ${MAX_TASKS} tasks`, count === MAX_TASKS, `${count} kept`)
  },
}

const boardScenarios = [linksBothWays, addsPastTheCap]

export default boardScenarios
