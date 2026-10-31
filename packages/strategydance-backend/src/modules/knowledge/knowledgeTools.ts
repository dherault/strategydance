import registerListKnowledge from '~modules/knowledge/tools/registerListKnowledge'
import registerReadKnowledge from '~modules/knowledge/tools/registerReadKnowledge'

/*
  The Knowledge module's tools, in the order `tools/list` gives them, which is the order Strategy
  Dance's agent will put them in its own list, after the Subagents module's: reads, then the writes
  knowledge-milestones.md's M2 appends. Reordering them changes that list, which costs every
  conversation its earlier reasoning once
*/
const KNOWLEDGE_TOOLS = [registerListKnowledge, registerReadKnowledge]

export default KNOWLEDGE_TOOLS
