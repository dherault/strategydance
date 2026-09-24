import type { MessageDescriptor } from 'react-intl'
import type { CompanyAspect } from 'strategydance-design-system/components/company/CompanyAspectIcon'

import navigationMessages from '~data/intl/messages/navigation'

// Each aspect's name in the reader's language. The design system's labels are English only
const aspectMessages: Record<CompanyAspect, MessageDescriptor> = {
  strategy: navigationMessages.aspectStrategy,
  people: navigationMessages.aspectPeople,
  finances: navigationMessages.aspectFinances,
  product: navigationMessages.aspectProduct,
  engineering: navigationMessages.aspectEngineering,
  design: navigationMessages.aspectDesign,
  marketing: navigationMessages.aspectMarketing,
  sales: navigationMessages.aspectSales,
  legal: navigationMessages.aspectLegal,
}

export default aspectMessages
