import { type GetDocumentPresencesData, getDocumentPresencesRef } from 'strategydance-database/web'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'

import { dataConnect } from '~data/firebase'

type Options = {
  organizationId: string
  documentId: string
  // False until the document is stored and its page can draw who is in it
  isEnabled: boolean
  // Every tab with the document open, the reader's own included, as each push lists them
  onNext: (rows: GetDocumentPresencesData['documentPresences']) => void
}

// Keeps a document's page told of who has it open, and where their caret is, as it changes
function useKnowledgeDocumentPresences({ organizationId, documentId, isEnabled, onNext }: Options) {
  useLiveQuerySubscription({
    name: 'presences',
    queryKey: isEnabled ? ['GetDocumentPresences', organizationId, documentId] : null,
    createQueryRef: () => getDocumentPresencesRef(dataConnect, { organizationId, id: documentId }),
    onNext: data => onNext(data.documentPresences),
  })
}

export default useKnowledgeDocumentPresences
