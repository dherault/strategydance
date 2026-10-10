import { type CompanyAspect, getDocumentForAgent, seedDocumentStateForAgent } from 'strategydance-database/backend'

import type { KnowledgeRefusal, ModuleCaller, SeededKnowledgeDocumentText } from '~types'

import { dataConnect } from '~firebase'

import explainKnowledgeDocumentRefusal from '~domain/knowledge/explainKnowledgeDocumentRefusal'
import { SEEDED_REFUSAL } from '~domain/knowledge/knowledgeRefusalMessages'
import seedKnowledgeDocumentText from '~domain/knowledge/seedKnowledgeDocumentText'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'

// How many times a read seeds a document a tab seeds meanwhile: once is enough, since a seeded
// document never goes back to having no snapshot, and the next read finds the tab's
const SEED_ATTEMPTS = 3

export type LoadedKnowledgeDocument = {
  title: string
  aspects: CompanyAspect[]
  isAiWritable: boolean
  updatedAt: string
  text: SeededKnowledgeDocumentText
}

type LoadKnowledgeDocumentResult = { outcome: 'loaded'; document: LoadedKnowledgeDocument } | KnowledgeRefusal

/*
  A document an agent may read, with its shared text seeded: the snapshot and the updates pending
  since. A document stored before the editor was shared has no snapshot, and so no ids for its
  blocks, which a read hands out: it is seeded from its content first, under `SeedDocumentState`'s
  condition, before anything is read of it, and a read that loses to a tab seeding it reads the
  tab's snapshot instead, so every read sees the same ids
*/
async function loadKnowledgeDocument(caller: ModuleCaller, id: string): Promise<LoadKnowledgeDocumentResult> {
  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    id,
  }

  for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt++) {
    const { data } = await getDocumentForAgent(dataConnect, reference)
    const [row] = data.documents

    if (!row) return (await explainKnowledgeDocumentRefusal(caller, id, { isWrite: false })) ?? { outcome: 'notFound' }

    const document = {
      title: row.title,
      aspects: row.aspects,
      isAiWritable: row.isAiWritable,
      updatedAt: row.updatedAt,
    }

    if (row.state) {
      return {
        outcome: 'loaded',
        document: { ...document, text: { state: row.state, updates: row.documentUpdates_on_document } },
      }
    }

    const state = seedKnowledgeDocumentText(row.content)

    try {
      await seedDocumentStateForAgent(dataConnect, { ...reference, state, revision: row.revision })

      // Nothing is pushed to a document with no snapshot, so it has no update pending
      return { outcome: 'loaded', document: { ...document, text: { state, updates: [] } } }
    } catch (error) {
      if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
      if (!isOperationRefusal(error, SEEDED_REFUSAL)) throw error
    }
  }

  throw new Error(`Document ${id} was seeded and changed over and over while the module read it`)
}

export default loadKnowledgeDocument
