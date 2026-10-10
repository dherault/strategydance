import { randomUUID } from 'node:crypto'

import { type CompanyAspect, createDocumentForAgent } from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import createKnowledgeDocumentText from '~domain/knowledge/createKnowledgeDocumentText'
import hashKnowledgeDocumentText from '~domain/knowledge/hashKnowledgeDocumentText'
import { FULL_REFUSAL } from '~domain/knowledge/knowledgeRefusalMessages'
import readKnowledgeDocumentText from '~domain/knowledge/readKnowledgeDocumentText'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

export type CreatedKnowledgeDocument = {
  id: string
  title: string
  aspects: CompanyAspect[]
  version: string
}

/*
  A new document an agent writes, its text in Markdown, stored as its first shared snapshot with
  `content` and `contentText` beside it, under the 1000 documents an organization keeps. Agents may
  read and change it, as a document made on the page starts, so the agent that made it can go on
  with it, and the team can turn either off. A call sent again under its key is answered as the
  first time
*/
async function createKnowledgeDocument(
  caller: ModuleCaller,
  { title, aspects, content }: { title: string; aspects: CompanyAspect[]; content: string },
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<CreatedKnowledgeDocument>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const text = createKnowledgeDocumentText(content)

  if (text.outcome !== 'measured') return text
  if (!/\S/.test(title) && text.content === '') return { outcome: 'empty' }

  const read = readKnowledgeDocumentText({ state: text.state, updates: [] })

  if (read.outcome !== 'read') return { outcome: 'invalidEdit' }

  const id = randomUUID().replaceAll('-', '')
  const result = { id, title, aspects, version: hashKnowledgeDocumentText(read.blocks) }

  try {
    await createDocumentForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id,
      title,
      aspects,
      state: text.state,
      content: text.content,
      contentText: text.contentText,
      ...toModuleCallVariables(caller, call, result),
    })
  } catch (error) {
    // A call under the same key wrote meanwhile, whose result answers this one
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, FULL_REFUSAL)) return { outcome: 'full' }
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

    throw error
  }

  return { outcome: 'written', result }
}

export default createKnowledgeDocument
