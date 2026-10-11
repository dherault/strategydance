import { type CompanyAspect, setDocumentAspectsForAgent } from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import explainKnowledgeDocumentRefusal from '~domain/knowledge/explainKnowledgeDocumentRefusal'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

export type TaggedKnowledgeDocument = {
  id: string
  aspects: CompanyAspect[]
}

/*
  Tags a document with its aspects for an agent, replacing them all, each at most once, as the
  aspects dialog does, held to what the team lets agents do with it as every change is
*/
async function setKnowledgeDocumentAspects(
  caller: ModuleCaller,
  { id, aspects }: { id: string; aspects: CompanyAspect[] },
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<TaggedKnowledgeDocument>> {
  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const result = { id, aspects }

  try {
    await setDocumentAspectsForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      id,
      aspects,
      ...toModuleCallVariables(caller, call, result),
    })

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

    const refusal = await explainKnowledgeDocumentRefusal(caller, id, { isWrite: true })

    if (refusal) return refusal

    throw error
  }
}

export default setKnowledgeDocumentAspects
