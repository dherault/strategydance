import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { MAX_DOCUMENTS } from 'strategydance-core'
import type { CompanyAspect } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useOrganizationKnowledgeDocuments from '~hooks/knowledge/useOrganizationKnowledgeDocuments'

import createId from '~utils/common/createId'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  // The aspect whose page it is on, which the new document starts tagged with
  aspect?: CompanyAspect
}

/*
  Opens a new document's page, a draft at the id it will have, which is stored only once something
  is written in it. The id is made on the click rather than in the render, which has to stay pure.

  An organization that keeps as many documents as it may gets no draft it could never store, but
  the reason. The list it counts is the one the page under `KnowledgeDocumentsWait` has read
*/
function AddKnowledgeDocumentButton({ aspect }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const { data: knowledgeDocuments } = useOrganizationKnowledgeDocuments()

  function add() {
    if (knowledgeDocuments.length >= MAX_DOCUMENTS) {
      toast.error(formatMessage(knowledgeMessages.addFull, { max: MAX_DOCUMENTS }))

      return
    }

    navigate({
      to: '/knowledge/$documentId',
      params: { documentId: createId() },
      search: { isNew: true, aspect },
    })
  }

  return (
    <Button
      size="sm"
      icon={<PlusIcon />}
      onClick={add}
    >
      {formatMessage(knowledgeMessages.add)}
    </Button>
  )
}

export default AddKnowledgeDocumentButton
