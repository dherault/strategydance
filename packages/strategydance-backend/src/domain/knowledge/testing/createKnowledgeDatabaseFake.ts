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

  // A link's target as its link operation holds it: a document of the organization the agent may
  // read, not deleted, a live task, or a member, with the message each operation refuses with
  function checkTarget(variables: AnyVariables, target: FakeKnowledgeLink['target']) {
    if (target === 'document') {
      const document = base.documents.get(id(variables.documentId))
      const isReadable =
        document !== undefined
        && document.organizationId === id(variables.organizationId)
        && document.deletedAt === null
        && document.isAiReadable

      if (!isReadable) refuse('No document agents may read by that id in the organization')
    } else if (target === 'task') {
      const task = base.tasks.get(id(variables.taskId))
      const isLive =
        task !== undefined && task.organizationId === id(variables.organizationId) && task.deletedAt === null

      if (!isLive) refuse('No task by that id in the organization')
    } else if (!membersOf(variables.organizationId).some(member => member.userId === variables.memberId)) {
      refuse('An item links a member of its organization')
    }
  }

  // The id a link operation names its target by
  function targetIdOf(variables: AnyVariables, target: FakeKnowledgeLink['target']) {
    if (target === 'document') return id(variables.documentId)
    if (target === 'task') return id(variables.taskId)

    return String(variables.memberId)
  }

  const PLURALS = { document: 'documents', task: 'tasks', member: 'members' } as const

  const TABLES = {
    document: 'knowledge_document_link',
    task: 'knowledge_task_link',
    member: 'knowledge_member_link',
  } as const

  // A link operation: the lock, the key, the target, the item's other links counted under the cap,
  // then the insert, refused on the link's key when it is there already
  function link(variables: AnyVariables, target: FakeKnowledgeLink['target']) {
    if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

    checkKey(variables)
    insertResult(variables)
    checkTarget(variables, target)

    const targetId = targetIdOf(variables, target)
    const itemLinks = linksOf(variables, variables.itemId, target)

    if (itemLinks.filter(link => link.targetId !== targetId).length >= 100) {
      refuse(`An item links at most 100 ${PLURALS[target]}`)
    }
    if (itemLinks.some(link => link.targetId === targetId)) {
      refuse(`violates SQL unique constraint: ${TABLES[target]}_pkey (aborted)`)
    }

    storeResult(variables)
    insertLink({
      organizationId: String(variables.organizationId),
      kind: String(variables.kind),
      itemId: String(variables.itemId),
      target,
      targetId,
    })
  }

  // An unlink operation: the membership, the key, then the one link the module read, those the agent
  // may not see left out, as the operation's filters leave them
  function unlink(variables: AnyVariables, target: FakeKnowledgeLink['target']) {
    if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

    checkKey(variables)
    insertResult(variables)

    const targetId = targetIdOf(variables, target)
    const removed = linksOf(variables, variables.itemId, target).filter(
      link => link.targetId === targetId && isVisible(link),
    )

    if (removed.length !== 1) refuse(`The item is not linked to that ${target}`)

    storeResult(variables)
    links.splice(links.indexOf(removed[0]!), 1)
  }

  // What a link's read answers of the item's links to one kind of target: every one, those the agent
  // may not see included, as the operation counts them
  function linkedIds(variables: AnyVariables, target: FakeKnowledgeLink['target']) {
    return isMember(variables) ? linksOf(variables, variables.itemId, target).slice(0, 100) : []
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

    GetKnowledgeDocumentLinkForAgent: variables => {
      const document = base.documents.get(id(variables.documentId))
      const isHeld = isMember(variables) && document?.organizationId === id(variables.organizationId)

      return {
        membership: membershipOf(variables),
        documents: isHeld
          ? [{ title: document!.title, isAiReadable: document!.isAiReadable, deletedAt: document!.deletedAt }]
          : [],
        knowledgeDocumentLinks: linkedIds(variables, 'document').map(link => ({ documentId: link.targetId })),
      }
    },

    GetKnowledgeTaskLinkForAgent: variables => {
      const task = base.tasks.get(id(variables.taskId))
      const isHeld = isMember(variables) && task?.organizationId === id(variables.organizationId)

      return {
        membership: membershipOf(variables),
        tasks: isHeld ? [{ name: task!.name, status: task!.status, deletedAt: task!.deletedAt }] : [],
        knowledgeTaskLinks: linkedIds(variables, 'task').map(link => ({ taskId: link.targetId })),
      }
    },

    GetKnowledgeMemberLinkForAgent: variables => ({
      membership: membershipOf(variables),
      members: isMember(variables)
        ? membersOf(variables.organizationId)
            .filter(member => member.userId === variables.memberId)
            .map(member => ({ user: { displayName: member.displayName } }))
        : [],
      knowledgeMemberLinks: linkedIds(variables, 'member').map(link => ({ membershipUserId: link.targetId })),
    }),

    LinkKnowledgeDocumentForAgent: variables => {
      link(variables, 'document')

      return { knowledgeDocumentLink_insert: { documentId: id(variables.documentId) } }
    },

    LinkKnowledgeTaskForAgent: variables => {
      link(variables, 'task')

      return { knowledgeTaskLink_insert: { taskId: id(variables.taskId) } }
    },

    LinkKnowledgeMemberForAgent: variables => {
      link(variables, 'member')

      return { knowledgeMemberLink_insert: { membershipUserId: variables.memberId } }
    },

    UnlinkKnowledgeDocumentForAgent: variables => {
      unlink(variables, 'document')

      return { knowledgeDocumentLink_deleteMany: 1 }
    },

    UnlinkKnowledgeTaskForAgent: variables => {
      unlink(variables, 'task')

      return { knowledgeTaskLink_deleteMany: 1 }
    },

    UnlinkKnowledgeMemberForAgent: variables => {
      unlink(variables, 'member')

      return { knowledgeMemberLink_deleteMany: 1 }
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
