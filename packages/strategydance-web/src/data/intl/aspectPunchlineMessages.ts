import type { MessageDescriptor } from 'react-intl'
import { CompanyAspect } from 'strategydance-database/web'

import aspectPageMessages from '~data/intl/messages/aspect'

// The line over each aspect's page title, in the reader's language
const aspectPunchlineMessages: Record<CompanyAspect, MessageDescriptor> = {
  [CompanyAspect.STRATEGY]: aspectPageMessages.punchlineStrategy,
  [CompanyAspect.PEOPLE]: aspectPageMessages.punchlinePeople,
  [CompanyAspect.FINANCES]: aspectPageMessages.punchlineFinances,
  [CompanyAspect.PRODUCT]: aspectPageMessages.punchlineProduct,
  [CompanyAspect.ENGINEERING]: aspectPageMessages.punchlineEngineering,
  [CompanyAspect.DESIGN]: aspectPageMessages.punchlineDesign,
  [CompanyAspect.MARKETING]: aspectPageMessages.punchlineMarketing,
  [CompanyAspect.SALES]: aspectPageMessages.punchlineSales,
  [CompanyAspect.LEGAL]: aspectPageMessages.punchlineLegal,
}

export default aspectPunchlineMessages
