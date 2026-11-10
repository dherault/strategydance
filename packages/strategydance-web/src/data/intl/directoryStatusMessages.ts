import type { MessageDescriptor } from 'react-intl'

import type { DirectoryStatusChoice } from '~types'

import directoryMessages from '~data/intl/messages/directory'

// Each status's name in the reader's language, To do's included, which is also its tab's
const directoryStatusMessages: Record<DirectoryStatusChoice, MessageDescriptor> = {
  TO_DO: directoryMessages.statusToDo,
  SUBMITTED: directoryMessages.statusSubmitted,
  LISTED: directoryMessages.statusListed,
  DISMISSED: directoryMessages.statusDismissed,
}

export default directoryStatusMessages
