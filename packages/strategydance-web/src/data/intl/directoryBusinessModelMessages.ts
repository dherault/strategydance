import type { MessageDescriptor } from 'react-intl'
import type { DirectoryBusinessModel } from 'strategydance-knowledge/src/directories/enums'

import directoryMessages from '~data/intl/messages/directory'

// What each business model of a directory is called, as its badge and the pricing filter say it
const directoryBusinessModelMessages: Record<DirectoryBusinessModel, MessageDescriptor> = {
  FREE: directoryMessages.pricingFree,
  FREE_WITH_BADGE: directoryMessages.pricingFreeWithBadge,
  FREE_WITH_GATE: directoryMessages.pricingFreeWithGate,
  FREE_WITH_LONG_QUEUE: directoryMessages.pricingFreeWithLongQueue,
  FREE_WITH_PAID_SKIP: directoryMessages.pricingFreeWithPaidSkip,
  FREE_WITH_ENGAGEMENT: directoryMessages.pricingFreeWithEngagement,
  FREE_WITH_CURATION: directoryMessages.pricingFreeWithCuration,
  FREE_WITH_PAID_PROMOTION: directoryMessages.pricingFreeWithPaidPromotion,
  FREE_FOR_LIMITED_TIME: directoryMessages.pricingFreeForLimitedTime,
  PAID: directoryMessages.pricingPaid,
  UNKNOWN: directoryMessages.pricingUnknown,
}

export default directoryBusinessModelMessages
