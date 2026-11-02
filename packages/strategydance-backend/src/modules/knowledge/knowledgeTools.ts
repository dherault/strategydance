import registerLinkKnowledge from '~modules/knowledge/tools/registerLinkKnowledge'
import registerListKnowledge from '~modules/knowledge/tools/registerListKnowledge'
import registerReadKnowledge from '~modules/knowledge/tools/registerReadKnowledge'
import registerSetKnowledgeInUse from '~modules/knowledge/tools/registerSetKnowledgeInUse'
import registerUnlinkKnowledge from '~modules/knowledge/tools/registerUnlinkKnowledge'

/*
  The Knowledge module's tools, in the order `tools/list` gives them, which is the order Strategy
  Dance's agent will put them in its own list, after the Subagents module's: reads, then writes.
  Reordering them changes that list, which costs every conversation its earlier reasoning once
*/
const KNOWLEDGE_TOOLS = [
  registerListKnowledge,
  registerReadKnowledge,
  registerSetKnowledgeInUse,
  registerLinkKnowledge,
  registerUnlinkKnowledge,
]

export default KNOWLEDGE_TOOLS
