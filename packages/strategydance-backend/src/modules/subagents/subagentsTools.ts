import registerLaunchSubagent from '~modules/subagents/tools/registerLaunchSubagent'
import registerListSubagents from '~modules/subagents/tools/registerListSubagents'
import registerReadSubagent from '~modules/subagents/tools/registerReadSubagent'
import registerStopSubagent from '~modules/subagents/tools/registerStopSubagent'

/*
  The Subagents module's tools, in the order `tools/list` gives them, which is the order Strategy
  Dance's agent will put them in its own list, after the Tasks module's: reads, then writes.
  Reordering them changes that list, which costs every conversation its earlier reasoning once
*/
const SUBAGENTS_TOOLS = [registerListSubagents, registerReadSubagent, registerLaunchSubagent, registerStopSubagent]

export default SUBAGENTS_TOOLS
