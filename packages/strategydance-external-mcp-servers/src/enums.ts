/*
  Const objects rather than TypeScript `enum`s, as in strategydance-core, so each name is a value
  and a type at once and no runtime enum object is emitted
*/

/*
  How a server takes Strategy Dance: each member's own account through OAuth, one key the
  organization gives for everybody, or nothing. The database's `IntegrationAuthentication` values,
  written out since this package reads no generated SDK
*/
export const ExternalMcpServerAuthentication = {
  OAUTH: 'OAUTH',
  API_KEY: 'API_KEY',
  NONE: 'NONE',
} as const

export type ExternalMcpServerAuthentication =
  (typeof ExternalMcpServerAuthentication)[keyof typeof ExternalMcpServerAuthentication]

/*
  How a key-based server reads its key: as a bearer token, or alone in a header of its own. The
  database's `IntegrationApiKeyScheme` values
*/
export const ExternalMcpServerApiKeyScheme = {
  BEARER: 'BEARER',
  HEADER: 'HEADER',
} as const

export type ExternalMcpServerApiKeyScheme =
  (typeof ExternalMcpServerApiKeyScheme)[keyof typeof ExternalMcpServerApiKeyScheme]

/*
  What part of a startup's work a server reaches, by which the Integrations page groups the servers
  an administrator adds in a click, in this order
*/
export const ExternalMcpServerCategory = {
  // Taking money: payments, subscriptions, a shop
  PAYMENTS: 'PAYMENTS',
  // The money a company holds and spends: its bank, its cards
  FINANCE: 'FINANCE',
  // Code, its errors, its databases and where it is hosted
  DEVELOPMENT: 'DEVELOPMENT',
  // Planning the work: issues, tasks, boards
  PROJECTS: 'PROJECTS',
  // What a team writes and keeps: documents, notes, files, forms
  DOCUMENTS: 'DOCUMENTS',
  // Making things look right: designs, boards, websites
  DESIGN: 'DESIGN',
  // Reaching people: email, newsletters, social media, search
  MARKETING: 'MARKETING',
  // Reading what users do in the product
  ANALYTICS: 'ANALYTICS',
  // The people a company sells to and helps: its CRM, its bookings, its support
  CUSTOMERS: 'CUSTOMERS',
  // Acting across other apps
  AUTOMATION: 'AUTOMATION',
} as const

export type ExternalMcpServerCategory = (typeof ExternalMcpServerCategory)[keyof typeof ExternalMcpServerCategory]
