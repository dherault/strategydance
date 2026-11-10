import { MODULES, SERVED_MODULE_NAMES, type ModuleName } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import joinInWords from '~utils/joinInWords'

import listModuleOrganizations from '~modules/listModuleOrganizations'
import MODULE_INSTRUCTIONS from '~modules/moduleInstructions'

// What every server says first, what Strategy Dance is
const INTRODUCTION = "Strategy Dance accompanies a company's team as it builds, sells and runs the company."

// What an agent acts as through a module that says no more of it
const ACTS_AS = 'You act as one member of the organization.'

// How to write safely through a served module, whose every write takes a key
const IDEMPOTENCY = `Every write tool takes an idempotency key in the call's _meta, under "${MODULE_IDEMPOTENCY_KEY_META}": send a new one with each write, and the same one when you send the same write again after losing its answer. A write sent again without a key can be applied twice.`

/*
  What a server tells an agent before it calls anything, for the access it is built for: what
  Strategy Dance is, what each module says of itself, how to write safely, and the organizations an
  external agent's connection reaches, which every tool takes as `organization`.

  A server of one module, `{ alone }`, says it of "This server", as a module's server always has. A
  server of several, `{ listed }`, the modules it lists, says what Strategy Dance is once, then each
  module in `MODULES`' order, each naming only modules listed, then the key and the organizations
  once. Last, an external agent's server of several names the modules it was given but does not
  list, `unheld`, which its connection is not allowed in, left out by the member or served since it
  connected: their tools are not listed, so this is how the agent learns they are there, and can
  tell the member, who chooses what a connection may do in each module when they connect it again.

  The key and the organizations are said where a served module is listed, whose tools take both.
  Knowledge and Subagents serve Strategy Dance's agent alone, which acts in its run's organization
  and reads no instructions, so they are told nothing more
*/
function toModuleInstructions(
  server: { alone: ModuleName } | { listed: readonly ModuleName[]; unheld?: readonly ModuleName[] },
  access: ModuleAccess,
) {
  const names = 'alone' in server ? [server.alone] : server.listed
  const isServed = names.some(name => SERVED_MODULE_NAMES.includes(name))

  return [
    ...('alone' in server ? toAlone(server.alone) : toSeveral(server.listed)),
    ...(isServed ? [IDEMPOTENCY, ...toReached(access)] : []),
    ...('listed' in server ? toUnheld(server.unheld ?? [], access) : []),
  ].join('\n\n')
}

// What a server of one module says of it
function toAlone(name: ModuleName) {
  const { holds, actsAs = ACTS_AS, paragraphs } = MODULE_INSTRUCTIONS[name]

  return [`${INTRODUCTION} This server ${holds} ${actsAs}`, ...paragraphs(null)]
}

// What a server of several modules says of the ones it lists, in `MODULES`' order, as it lists their
// tools, whatever the order given
function toSeveral(given: readonly ModuleName[]) {
  const listed = MODULES.filter(({ name }) => given.includes(name)).map(({ name }) => name)
  const labels = joinInWords(listed.map(name => MODULE_INSTRUCTIONS[name].label))

  if (!labels) return [`${INTRODUCTION} ${ACTS_AS}`]

  const opening =
    listed.length > 1
      ? `This server holds Strategy Dance's ${labels} modules, and you act as one member of the organization in each.`
      : `This server holds Strategy Dance's ${labels} module, and you act as one member of the organization in it.`

  return [
    `${INTRODUCTION} ${opening}`,
    ...listed.flatMap(name => {
      const { label, holds, actsAs, paragraphs } = MODULE_INSTRUCTIONS[name]

      return [`The ${label} module ${holds}${actsAs ? ` ${actsAs}` : ''}`, ...paragraphs(listed)]
    }),
  ]
}

// The organizations an external agent's connection reaches, which Strategy Dance's agent is not told
function toReached(access: ModuleAccess) {
  if (access.kind === 'agent') return []

  const { organizations } = access

  if (organizations.length === 1) {
    return [
      `This connection reaches one of the member's organizations, ${listModuleOrganizations(organizations, 'and')}, which every tool takes as organization.`,
    ]
  }

  return [
    `This connection reaches ${organizations.length} of the member's organizations, ${listModuleOrganizations(organizations, 'and')}, and every tool takes the one its call acts in as organization. Each id belongs to one organization: name the one it came from. When the member has not said which organization they mean, ask them rather than choose.`,
  ]
}

// The modules an external agent's connection is not allowed in, which the server serves beside
// those it lists, in `MODULES`' order: named, never their tools, without saying why, since the
// member may have left one out or the server may have served it since. Strategy Dance's agent
// holds every module
function toUnheld(given: readonly ModuleName[], access: ModuleAccess) {
  const unheld = MODULES.filter(({ name }) => given.includes(name))

  if (access.kind === 'agent' || !unheld.length) return []

  const labels = joinInWords(unheld.map(({ name }) => MODULE_INSTRUCTIONS[name].label))

  return [
    `This connection is not allowed in the ${labels} module${unheld.length > 1 ? 's' : ''}, which this server serves too. When the member asks for something there, tell them so: they choose what this connection may do in each module when they connect you again.`,
  ]
}

export default toModuleInstructions
