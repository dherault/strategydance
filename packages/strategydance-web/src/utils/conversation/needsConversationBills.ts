import { ConversationMessageKind } from 'strategydance-database/web'

import type { ConversationThreadEntry } from '~types'

// The tool whose row offers Restore, which the organization's bills say it can
export const DELETE_BILL_TOOL_NAME = 'delete_bill'

/*
  Whether a thread draws anything the organization's bills decide: a row that deleted one, which
  offers Restore while the bill is gone from them. A thread without one never reads the bills
*/
function needsConversationBills(entries: ConversationThreadEntry[]) {
  return entries.some(
    entry => entry.kind === ConversationMessageKind.TOOL_CALL && entry.toolName === DELETE_BILL_TOOL_NAME,
  )
}

export default needsConversationBills
