import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'
import { MAX_DOCUMENTS } from 'strategydance-core'
import type { CompanyAspect } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useOrganizationDocuments from '~hooks/document/useOrganizationDocuments'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import createId from '~utils/common/createId'

import documentMessages from '~data/intl/messages/document'

type Props = {
  // The aspect whose page it is on, which the new document starts tagged with
  aspect?: CompanyAspect
  // Small in a section's head or an empty state, the fields' height in a page's toolbar
  size?: ComponentProps<typeof Button>['size']
}

/*
  Opens a new document's page, a draft at the id it will have, which is stored only once something
  is written in it. The id is made on the click rather than in the render, which has to stay pure.

  An organization that keeps as many documents as it may gets no draft it could never store, but
  the reason. The list it counts is the one the page under `OrganizationDocumentsWait` has read
*/
function AddDocumentButton({ aspect, size = 'sm' }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { data: organizationDocuments } = useOrganizationDocuments()

  function add() {
    if (organizationDocuments.length >= MAX_DOCUMENTS) {
      toast.error(formatMessage(documentMessages.addFull, { max: MAX_DOCUMENTS }))

      return
    }

    navigate({
      to: '/$organizationSlug/knowledge/$documentId',
      params: { organizationSlug, documentId: createId() },
      search: { isNew: true, aspect },
    })
  }

  return (
    <Button
      size={size}
      icon={<PlusIcon />}
      onClick={add}
    >
      {formatMessage(documentMessages.add)}
    </Button>
  )
}

export default AddDocumentButton
