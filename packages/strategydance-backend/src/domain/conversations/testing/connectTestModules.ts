import type { ConversationModules, ConversationToolRunner } from '~types'

/*
  Modules as a test brings them in to a run: the runners it gives, in place of the modules' own, and
  no tools of theirs in the run's requests, which then send the agent's own alone
*/
function connectTestModules(runners: ConversationToolRunner[]) {
  return async (): Promise<ConversationModules> => ({ tools: [], runners, close: async () => {} })
}

export default connectTestModules
