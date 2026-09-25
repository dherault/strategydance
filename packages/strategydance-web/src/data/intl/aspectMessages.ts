import type { MessageDescriptor } from 'react-intl'
import { CompanyAspect } from 'strategydance-database/web'

import navigationMessages from '~data/intl/messages/navigation'

// Each aspect's name in the reader's language. The design system's labels are English only
const aspectMessages: Record<CompanyAspect, MessageDescriptor> = {
  [CompanyAspect.STRATEGY]: navigationMessages.aspectStrategy,
  [CompanyAspect.PEOPLE]: navigationMessages.aspectPeople,
  [CompanyAspect.FINANCES]: navigationMessages.aspectFinances,
  [CompanyAspect.PRODUCT]: navigationMessages.aspectProduct,
  [CompanyAspect.ENGINEERING]: navigationMessages.aspectEngineering,
  [CompanyAspect.DESIGN]: navigationMessages.aspectDesign,
  [CompanyAspect.MARKETING]: navigationMessages.aspectMarketing,
  [CompanyAspect.SALES]: navigationMessages.aspectSales,
  [CompanyAspect.LEGAL]: navigationMessages.aspectLegal,
}

export default aspectMessages
