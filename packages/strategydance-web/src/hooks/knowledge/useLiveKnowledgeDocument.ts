import { type GetLiveDocumentData, getLiveDocumentRef } from 'strategydance-database/web'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'

import { dataConnect } from '~data/firebase'

type Options = {
  organizationId: string
  documentId: string
  // False until the document is stored, as a draft's is not
  isEnabled: boolean
  // Each pushed document, or null once it is gone, deleted or out of the reader's reach
  onNext: (document: GetLiveDocumentData['documents'][number] | null) => void
}

/*
  Keeps a document's page told of what changes it from elsewhere: its fields, and the edits to its
  text pending beside its snapshot, which `GetLiveDocument` pushes after every save and push. The
  page reads the document whole once, through `useKnowledgeDocument`, and takes each push from
  then on
*/
function useLiveKnowledgeDocument({ organizationId, documentId, isEnabled, onNext }: Options) {
  useLiveQuerySubscription({
    name: 'document',
    queryKey: isEnabled ? ['GetLiveDocument', organizationId, documentId] : null,
    createQueryRef: () => getLiveDocumentRef(dataConnect, { organizationId, id: documentId }),
    onNext: data => onNext(data.documents[0] ?? null),
  })
}

export default useLiveKnowledgeDocument
