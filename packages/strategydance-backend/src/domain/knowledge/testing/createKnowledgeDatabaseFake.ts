import { KnowledgeKind } from 'strategydance-core'

import type { FakeDocument } from '~domain/documents/testing/createDocumentsDatabaseFake'
import type { AnyVariables, ModuleDatabaseFakeBase } from '~domain/modules/testing/createModuleDatabaseFakeBase'
import type { FakeTask } from '~domain/tasks/testing/createTasksDatabaseFake'

/*
  The backend connector's Knowledge module operations, over tables kept in memory, added to a module
  database fake's base after the Documents and Tasks modules' fakes, whose documents, tasks and
  members its links read, for the modules' tests. Each operation mirrors the conditions of its
  namesake in the connector, in the same order, and throws the same messages, so a test reads as the
  behaviour it checks. `check:knowledge-module` checks those conditions against the emulators, which
  is what keeps the two alike: change one with the other.

  A link whose document or task those fakes no longer hold was pruned with it, as the reference
  cascades, so nothing here reads it, and a member's links go with the membership
*/

export type FakeKnowledgeUse = {
  organizationId: string
  kind: string
  itemId: string
  isInUse: boolean
  changedAt: string
  changedById: string | null
}

export type FakeKnowledgeLink = {
  organizationId: string
  kind: string
  itemId: string
  target: 'document' | 'task' | 'member'
  // The document's or the task's id, or the member's user id
  targetId: string
  createdAt: string
}

// What the base holds once the Documents and Tasks modules' fakes joined it
type Base = ModuleDatabaseFakeBase & { documents: Map<string, FakeDocument>; tasks: Map<string, FakeTask> }

function createKnowledgeDatabaseFake<Holder extends Base>(base: Holder) {
  const { stamp, id, isMember, membersOf, membershipOf, insertResult, storeResult, checkKey } = base
  const uses: FakeKnowledgeUse[] = []
  const links: FakeKnowledgeLink[] = []

  // Declared here rather than read off the base, so a call narrows what follows it
  function refuse(message: string): never {
    throw new Error(message)
  }

  // A use written straight into its table, whatever its id, as an earlier release may have written one
  function insertUse(fields: Partial<FakeKnowledgeUse> & { organizationId: string; kind: string; itemId: string }) {
    const use: FakeKnowledgeUse = { isInUse: true, changedAt: stamp(), changedById: null, ...fields }

    use.organizationId = id(use.organizationId)
    uses.push(use)

    return use
  }

  // A link written straight into its table, created now unless `createdAt` says when
  function insertLink(fields: Omit<FakeKnowledgeLink, 'createdAt'> & { createdAt?: string }): FakeKnowledgeLink {
    const link = { createdAt: stamp(), ...fields }

    link.organizationId = id(link.organizationId)
    if (link.target !== 'member') link.targetId = id(link.targetId)
    links.push(link)

    return link
  }

  function findUse(variables: AnyVariables, itemId: unknown) {
    return uses.find(
      use =>
        use.organizationId === id(variables.organizationId) && use.kind === variables.kind && use.itemId === itemId,
    )
  }

  // Whether a link's target is still there, as a pruned document or task, or a removed member, takes
  // its links with it
  function isHeld(link: FakeKnowledgeLink) {
    if (link.target === 'document') return base.documents.has(link.targetId)
    if (link.target === 'task') return base.tasks.has(link.targetId)

    return membersOf(link.organizationId).some(member => member.userId === link.targetId)
  }

  // Whether the agent may see a link: to a document it may read, not deleted, or a task not deleted
  function isVisible(link: FakeKnowledgeLink) {
    if (link.target === 'document') {
      const document = base.documents.get(link.targetId)

      return document !== undefined && document.deletedAt === null && document.isAiReadable
    }

    if (link.target === 'task') return base.tasks.get(link.targetId)?.deletedAt === null

    return true
  }

  // An item's links to one kind of target, those whose target went with it left out
  function linksOf(variables: AnyVariables, itemId: unknown, target: FakeKnowledgeLink['target']) {
    return links.filter(
      link =>
        link.organizationId === id(variables.organizationId)
        && link.kind === variables.kind
        && link.itemId === itemId
        && link.target === target
        && isHeld(link),
    )
  }

  // The links a read answers, newest first and then by target, as its `orderBy` reads them
  function readLinks(variables: AnyVariables, target: FakeKnowledgeLink['target']) {
    const itemIds = variables.itemIds as string[]

    return links
      .filter(
        link =>
          link.organizationId === id(variables.organizationId)
          && link.kind === variables.kind
          && itemIds.includes(link.itemId)
          && link.target === target
          && isHeld(link)
          && isVisible(link),
      )
      .sort((a, b) =>
        a.createdAt !== b.createdAt ? (a.createdAt > b.createdAt ? -1 : 1) : a.targetId < b.targetId ? -1 : 1,
      )
      .slice(0, 1000)
  }

  base.sdk.KnowledgeKind = KnowledgeKind

  base.addOperations({
    GetKnowledgeUsesForAgent: variables => ({
      membership: membershipOf(variables),
      knowledgeUses: isMember(variables)
        ? uses
            .filter(
              use => use.organizationId === id(variables.organizationId) && use.kind === variables.kind && use.isInUse,
            )
            .slice(0, 5000)
            .map(({ kind, itemId }) => ({ kind, itemId }))
        : [],
    }),

    GetKnowledgeItemsForAgent: variables => {
      if (!isMember(variables)) {
        return {
          membership: [],
          knowledgeUses: [],
          knowledgeDocumentLinks: [],
          knowledgeTaskLinks: [],
          knowledgeMemberLinks: [],
        }
      }

      return {
        membership: membershipOf(variables),
        knowledgeUses: (variables.itemIds as string[])
          .map(itemId => findUse(variables, itemId))
          .filter(use => use !== undefined)
          .slice(0, 10)
          .map(({ itemId, isInUse, changedAt }) => ({ itemId, isInUse, changedAt })),
        knowledgeDocumentLinks: readLinks(variables, 'document').map(({ itemId, targetId }) => ({
          itemId,
          document: { id: targetId, title: base.documents.get(targetId)!.title },
        })),
        knowledgeTaskLinks: readLinks(variables, 'task').map(({ itemId, targetId }) => {
          const task = base.tasks.get(targetId)!

          return { itemId, task: { id: targetId, name: task.name, status: task.status } }
        }),
        knowledgeMemberLinks: readLinks(variables, 'member').map(({ itemId, organizationId, targetId }) => ({
          itemId,
          membership: {
            userId: targetId,
            user: { displayName: membersOf(organizationId).find(member => member.userId === targetId)!.displayName },
          },
        })),
      }
    },

    SetKnowledgeInUseForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      insertResult(variables)
      storeResult(variables)

      const use = findUse(variables, variables.itemId)
      const fields = { isInUse: Boolean(variables.isInUse), changedAt: stamp(), changedById: String(variables.userId) }

      if (use) Object.assign(use, fields)
      else {
        insertUse({
          organizationId: String(variables.organizationId),
          kind: String(variables.kind),
          itemId: String(variables.itemId),
          ...fields,
        })
      }

      return {
        knowledgeUse_upsert: {
          organizationId: id(variables.organizationId),
          kind: variables.kind,
          itemId: variables.itemId,
        },
      }
    },
  })

  base.onRemoveMember((userId, organizationId) => {
    links.splice(
      0,
      links.length,
      ...links.filter(
        link => link.target !== 'member' || link.targetId !== userId || link.organizationId !== organizationId,
      ),
    )
  })

  base.onReset(() => {
    uses.length = 0
    links.length = 0
  })

  return Object.assign(base, { knowledgeUses: uses, knowledgeLinks: links, insertUse, insertLink, linksOf })
}

export type KnowledgeDatabaseFake = ReturnType<typeof createKnowledgeDatabaseFake<Base>>

export default createKnowledgeDatabaseFake
