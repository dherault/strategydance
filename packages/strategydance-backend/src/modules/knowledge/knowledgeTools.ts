import registerCreateDocument from '~modules/knowledge/tools/registerCreateDocument'
import registerDeleteDocument from '~modules/knowledge/tools/registerDeleteDocument'
import registerListDocuments from '~modules/knowledge/tools/registerListDocuments'
import registerReadDocument from '~modules/knowledge/tools/registerReadDocument'
import registerRestoreDocument from '~modules/knowledge/tools/registerRestoreDocument'
import registerSearchDocuments from '~modules/knowledge/tools/registerSearchDocuments'
import registerSetDocumentAspects from '~modules/knowledge/tools/registerSetDocumentAspects'
import registerUpdateDocument from '~modules/knowledge/tools/registerUpdateDocument'

/*
  The Knowledge module's tools, in the order `tools/list` gives them, which is the order Strategy
  Dance's agent puts them in its own list: reads, then writes. Reordering them changes that list,
  which costs every conversation its earlier reasoning once
*/
const KNOWLEDGE_TOOLS = [
  registerSearchDocuments,
  registerListDocuments,
  registerReadDocument,
  registerCreateDocument,
  registerUpdateDocument,
  registerSetDocumentAspects,
  registerDeleteDocument,
  registerRestoreDocument,
]

export default KNOWLEDGE_TOOLS
