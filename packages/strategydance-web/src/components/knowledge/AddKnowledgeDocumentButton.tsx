import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'

import createId from '~utils/common/createId'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  // The aspect whose page it is on, which the new document starts tagged with
  aspect?: CompanyAspect
}

/*
  Opens a new document's page, a draft at the id it will have, which is stored only once something
  is written in it. The id is made on the click rather than in the render, which has to stay pure
*/
function AddKnowledgeDocumentButton({ aspect }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()

  return (
    <Button
      size="sm"
      icon={<PlusIcon />}
      onClick={() =>
        navigate({
          to: '/knowledge/$documentId',
          params: { documentId: createId() },
          search: { isNew: true, aspect },
        })
      }
    >
      {formatMessage(knowledgeMessages.add)}
    </Button>
  )
}

export default AddKnowledgeDocumentButton
