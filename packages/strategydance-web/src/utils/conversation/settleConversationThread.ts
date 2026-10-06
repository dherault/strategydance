import type { ConversationThreadState } from '~types'

/*
  Ends a fill once the verified range has reached where it was going: below a gap, the range the
  entries under it were verified from comes back, since they never stopped being current
*/
function settleConversationThread(state: ConversationThreadState): ConversationThreadState {
  if (state.fillTo === null || state.verifiedFrom > state.fillTo) return state

  const { resume } = state
  const isResumed = resume !== null && resume.verifiedFrom < state.verifiedFrom

  return {
    ...state,
    fillTo: null,
    resume: null,
    verifiedFrom: isResumed ? resume.verifiedFrom : state.verifiedFrom,
    hasOlder: isResumed ? resume.hasOlder : state.hasOlder,
  }
}

export default settleConversationThread
