import type { MessageDescriptor } from 'react-intl'
import type { ExternalMcpServerCategory } from 'strategydance-external-mcp-servers'

import integrationMessages from '~data/intl/messages/integration'

// Typed over every category, so one added to the package fails the typecheck until it is worded here
const CATEGORY_MESSAGES: Record<ExternalMcpServerCategory, MessageDescriptor> = {
  PAYMENTS: integrationMessages.categoryPayments,
  FINANCE: integrationMessages.categoryFinance,
  DEVELOPMENT: integrationMessages.categoryDevelopment,
  PROJECTS: integrationMessages.categoryProjects,
  DOCUMENTS: integrationMessages.categoryDocuments,
  DESIGN: integrationMessages.categoryDesign,
  MARKETING: integrationMessages.categoryMarketing,
  ANALYTICS: integrationMessages.categoryAnalytics,
  CUSTOMERS: integrationMessages.categoryCustomers,
  AUTOMATION: integrationMessages.categoryAutomation,
  COMMUNICATION: integrationMessages.categoryCommunication,
  PEOPLE: integrationMessages.categoryPeople,
}

// The heading of a group of the gallery's servers
function getExternalMcpServerCategoryMessage(category: ExternalMcpServerCategory) {
  return CATEGORY_MESSAGES[category]
}

export default getExternalMcpServerCategoryMessage
