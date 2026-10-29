import registerCreateDocument from '~modules/documents/tools/registerCreateDocument'
import registerDeleteDocument from '~modules/documents/tools/registerDeleteDocument'
import registerListDocuments from '~modules/documents/tools/registerListDocuments'
import registerReadDocument from '~modules/documents/tools/registerReadDocument'
import registerRestoreDocument from '~modules/documents/tools/registerRestoreDocument'
import registerSearchDocuments from '~modules/documents/tools/registerSearchDocuments'
import registerSetDocumentAspects from '~modules/documents/tools/registerSetDocumentAspects'
import registerUpdateDocument from '~modules/documents/tools/registerUpdateDocument'

/*
  The Documents module's tools, in the order `tools/list` gives them, which is the order Strategy
  Dance's agent puts them in its own list: reads, then writes. Reordering them changes that list,
  which costs every conversation its earlier reasoning once
*/
const DOCUMENTS_TOOLS = [
  registerSearchDocuments,
  registerListDocuments,
  registerReadDocument,
  registerCreateDocument,
  registerUpdateDocument,
  registerSetDocumentAspects,
  registerDeleteDocument,
  registerRestoreDocument,
]

export default DOCUMENTS_TOOLS
