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

const organizationScenarios = [administratorsOnEachOther]

export default organizationScenarios
