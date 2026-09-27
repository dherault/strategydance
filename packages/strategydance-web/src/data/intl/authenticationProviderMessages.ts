import type { MessageDescriptor } from 'react-intl'
import { AuthenticationProvider } from 'strategydance-database/web'

import administrationMessages from '~data/intl/messages/administration'

// Each way of signing in, named in the reader's language
const authenticationProviderMessages: Record<AuthenticationProvider, MessageDescriptor> = {
  [AuthenticationProvider.PASSWORD]: administrationMessages.providerPassword,
  [AuthenticationProvider.GOOGLE]: administrationMessages.providerGoogle,
}

export default authenticationProviderMessages
