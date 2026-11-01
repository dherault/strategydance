import type { ModuleName } from 'strategydance-core'

/*
  The modules Strategy Dance's agent uses, in `MODULES`' order, each of whose servers a run's worker
  connects to in process, their tools listed after the agent's own: Documents from M16, the Tasks
  module from M17, the Subagents module from M33, whose tools a subagent never gets, the Budget
  module from budget-milestones.md's M10, and the Knowledge module from knowledge-milestones.md's M3.
  Adding one changes the tools every conversation's requests send, as `CONVERSATION_TOOLS` does
*/
const CONVERSATION_MODULES: ModuleName[] = ['documents', 'tasks', 'budget', 'subagents', 'knowledge']

export default CONVERSATION_MODULES
