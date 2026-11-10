import { deleteOrganization } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import { type Member, asMember, createTeam, read } from './raceFixtures'
import { JITTERS, type RaceScenario, describe, race } from './raceHarness'

type Act = 'remove' | 'demote'

// What each administrator does to the other, in turn: both remove, both demote, one removes as the
// other demotes
const ACTS: [Act, Act][] = [
  ['remove', 'remove'],
  ['demote', 'demote'],
  ['remove', 'demote'],
]

// The team page's ban or its Make member, as the administrator's own token sends it
function act(actor: Member, target: Member, how: Act) {
  const variables = { organizationId: actor.organizationId, userId: target.userId }

  return how === 'remove'
    ? asMember(actor).run('RemoveOrganizationMember', variables)
    : asMember(actor).run('UpdateOrganizationMemberRole', { ...variables, role: 'MEMBER' })
}

async function readRoles(organizationId: string) {
  const data = await read<{ userOrganizations: { userId: string; role: string }[] }>(
    `query ReadRoles($organizationId: UUID!) {
      userOrganizations(where: { organizationId: { eq: $organizationId } }) { userId role }
    }`,
    { organizationId },
  )

  return data.userOrganizations
}

/*
  The two administrators of an organization acting on each other at once, each from the team page:
  were both to go through, the organization would keep no administrator, which every change to who
  administers it refuses
*/
const administratorsOnEachOther: RaceScenario = {
  name: 'administrators-on-each-other',
  description: 'two administrators removing or demoting each other at once leave one administrator',
  async run({ round, jitter, expect }) {
    const {
      organizationId,
      members: [first, second],
    } = await createTeam('administrators', round, ['ADMINISTRATOR', 'ADMINISTRATOR'])
    // Each pair of acts goes through every jitter in turn
    const [firstAct, secondAct] = ACTS[Math.floor((round - 1) / JITTERS.length) % ACTS.length]!
    const results = await race<unknown>(
      {
        [`first ${firstAct}s`]: () => act(first!, second!, firstAct),
        [`second ${secondAct}s`]: () => act(second!, first!, secondAct),
      },
      jitter,
    )
    const passed = Object.values(results).filter(({ status }) => status === 'fulfilled').length
    const roles = await readRoles(organizationId)
    const administrators = roles.filter(({ role }) => role === 'ADMINISTRATOR')

    expect(
      'one of the two goes through',
      passed === 1,
      Object.entries(results)
        .map(([writer, result]) => `${writer} ${describe(result)}`)
        .join(', '),
    )
    expect(
      'the organization keeps one administrator',
      administrators.length === 1,
      roles.map(({ userId, role }) => `${userId.split('-').at(-1)} ${role}`).join(', ') || 'nobody left',
    )
  },
}

/*
  An administrator deleting the organization as the other demotes or removes them, from the team
  page: the two run one after the other, each taking the organization's row first, so the delete
  either goes through, and the other finds no organization, or reads the caller demoted and
  refuses, never a deadlock failing one of them. The backend sweeps the organization's files before
  its delete, which no organization of a race keeps, so the race sends the delete alone
*/
const deleteBesideDemotion: RaceScenario = {
  name: 'delete-beside-demotion',
  description: 'an administrator deleting the organization as another demotes or removes them runs one first',
  async run({ round, jitter, expect }) {
    const {
      organizationId,
      members: [deleter, other],
    } = await createTeam('delete-beside-demotion', round, ['ADMINISTRATOR', 'ADMINISTRATOR'])
    // Each act goes through every jitter in turn
    const how: Act = Math.floor((round - 1) / JITTERS.length) % 2 ? 'remove' : 'demote'
    const results = await race<unknown>(
      {
        'first deletes': () => deleteOrganization(dataConnect, { organizationId, userId: deleter!.userId }),
        [`second ${how}s them`]: () => act(other!, deleter!, how),
      },
      jitter,
    )
    const passed = Object.values(results).filter(({ status }) => status === 'fulfilled').length
    const data = await read<{ organization: { id: string } | null }>(
      'query ReadOrganization($id: UUID!) { organization(id: $id) { id } }',
      { id: organizationId },
    )
    const isDeleted = results['first deletes']?.status === 'fulfilled'

    expect(
      'one of the two goes through',
      passed === 1,
      Object.entries(results)
        .map(([writer, result]) => `${writer} ${describe(result)}`)
        .join(', '),
    )
    expect(
      'the organization is gone exactly when the delete went through',
      (data.organization === null) === isDeleted,
      data.organization ? 'still there' : 'gone',
    )
  },
}

const organizationScenarios = [administratorsOnEachOther, deleteBesideDemotion]

export default organizationScenarios
