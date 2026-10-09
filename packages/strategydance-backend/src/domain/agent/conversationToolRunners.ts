import type { ConversationToolRunner } from '~types'

/*
  The tools of `CONVERSATION_TOOLS` a run's worker runs, by the name Claude calls them by. None yet:
  `ask_user` is answered by the member, and the milestones that give the agent knowledge, the team,
  the log and the top priority add theirs
*/
const CONVERSATION_TOOL_RUNNERS: ConversationToolRunner[] = []

export default CONVERSATION_TOOL_RUNNERS
