import type { MessageDescriptor } from 'react-intl'
import type { DirectoryCategory } from 'strategydance-knowledge/src/directories/enums'

import directoryMessages from '~data/intl/messages/directory'

// What each kind of product a directory lists is called, in its badges and the category filter
const directoryCategoryMessages: Record<DirectoryCategory, MessageDescriptor> = {
  ANY_STARTUP: directoryMessages.categoryAnyStartup,
  AI_TOOLS: directoryMessages.categoryAiTools,
  AI_AGENTS: directoryMessages.categoryAiAgents,
  MCP_SERVERS: directoryMessages.categoryMcpServers,
  SAAS: directoryMessages.categorySaas,
  DEVELOPER_TOOLS: directoryMessages.categoryDeveloperTools,
  OPEN_SOURCE: directoryMessages.categoryOpenSource,
  NO_CODE: directoryMessages.categoryNoCode,
  MOBILE_APPS: directoryMessages.categoryMobileApps,
  DESIGN: directoryMessages.categoryDesign,
  MARKETING: directoryMessages.categoryMarketing,
  REGIONAL: directoryMessages.categoryRegional,
}

export default directoryCategoryMessages
