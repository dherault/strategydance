import { use } from 'react'

import ConversationDockContext from '~contexts/ConversationDockContext'

function useConversationDock() {
  return use(ConversationDockContext)
}

export default useConversationDock
