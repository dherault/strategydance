import { defineMessages } from 'react-intl'

/*
  The Integrations page: the MCP servers an organization adds so Strategy Dance, the app's AI, can
  use other companies' tools in conversations, which its administrators add, change, turn on and off
  and delete, and every member reads
*/
const integrationMessages = defineMessages({
  lead: {
    id: 'integration.lead',
    defaultMessage: 'MCP servers Strategy Dance can use in conversations.',
    description:
      'Introduction under the title of the Integrations page. MCP servers are other companies\' services, such as a payment provider or an issue tracker, that Strategy Dance, the app\'s AI, can call. Keep "MCP" as it is.',
  },
  leadAvailable: {
    id: 'integration.leadAvailable',
    defaultMessage: '{available} of {total} available right now.',
    description:
      'Second sentence of the Integrations page\'s introduction, counting the organization\'s servers that are on and working, such as "3 of 5 available right now."',
  },
  leadMembers: {
    id: 'integration.leadMembers',
    defaultMessage: 'Only administrators can change them.',
    description:
      "Last sentence of the Integrations page's introduction, shown to members who do not administer the organization, who can read the servers but not change them.",
  },
  addServer: {
    id: 'integration.addServer',
    defaultMessage: 'Add server',
    description: 'Button on the Integrations page that opens the dialog for adding an MCP server by its address.',
  },
  emptyTitle: {
    id: 'integration.emptyTitle',
    defaultMessage: 'No MCP servers yet',
    description: 'Title shown on the Integrations page when the organization has added no server.',
  },
  emptyText: {
    id: 'integration.emptyText',
    defaultMessage:
      'Connect tools like your calendar, issue tracker or payments so Strategy Dance can use them in conversations.',
    description: 'Text under the title shown on the Integrations page when the organization has added no server.',
  },
  loadError: {
    id: 'integration.loadError',
    defaultMessage: "The organization's servers could not be loaded.",
    description: 'Error shown in place of the table of servers when it could not be read.',
  },
  columnServer: {
    id: 'integration.columnServer',
    defaultMessage: 'Server',
    description: "Heading of the column of the servers table that holds each server's mark, name and address.",
  },
  columnStatus: {
    id: 'integration.columnStatus',
    defaultMessage: 'Status',
    description: 'Heading of the column of the servers table that says whether each server works.',
  },
  columnOn: {
    id: 'integration.columnOn',
    defaultMessage: 'On',
    description:
      'Heading of the column of the servers table holding a switch that turns each server on or off for Strategy Dance. As short as possible.',
  },
  columnLastUsed: {
    id: 'integration.columnLastUsed',
    defaultMessage: 'Last used',
    description: 'Heading of the column of the servers table that says when Strategy Dance last called each server.',
  },
  columnActions: {
    id: 'integration.columnActions',
    defaultMessage: 'Actions',
    description: 'Heading, read by screen readers only, of the column holding the buttons of each server.',
  },
  authenticationOAuth: {
    id: 'integration.authenticationOAuth',
    defaultMessage: 'OAuth',
    description:
      'How a server lets Strategy Dance in: each member signs in with their own account. Shown beside the server\'s address and as a choice in its dialog. Keep "OAuth" as it is.',
  },
  authenticationApiKey: {
    id: 'integration.authenticationApiKey',
    defaultMessage: 'API key',
    description:
      "How a server lets Strategy Dance in: one key the organization gives for everybody. Shown beside the server's address and as a choice in its dialog.",
  },
  authenticationNone: {
    id: 'integration.authenticationNone',
    defaultMessage: 'No authentication',
    description:
      "How a server lets Strategy Dance in: it asks for nothing. Shown beside the server's address and as a choice in its dialog.",
  },
  statusOff: {
    id: 'integration.statusOff',
    defaultMessage: 'Off',
    description: 'Badge on a server an administrator turned off, which Strategy Dance does not call.',
  },
  statusConnected: {
    id: 'integration.statusConnected',
    defaultMessage: 'Connected',
    description: 'Badge on a server that works: Strategy Dance reached it and read its tools.',
  },
  statusNeedsAuthentication: {
    id: 'integration.statusNeedsAuthentication',
    defaultMessage: 'Needs authentication',
    description:
      'Badge on a server whose tools wait until a member signs in to it with their own account, which nobody has yet.',
  },
  statusError: {
    id: 'integration.statusError',
    defaultMessage: 'Error',
    description: 'Badge on a server that could not be reached the last time Strategy Dance tried.',
  },
  turnOn: {
    id: 'integration.turnOn',
    defaultMessage: 'Turn on {name}',
    description:
      'Accessible label of the switch that turns a server on, where {name} is the server\'s name, such as "Stripe".',
  },
  turnOff: {
    id: 'integration.turnOff',
    defaultMessage: 'Turn off {name}',
    description: "Accessible label of the switch that turns a server off, where {name} is the server's name.",
  },
  turnedOn: {
    id: 'integration.turnedOn',
    defaultMessage: '{name} turned on',
    description: 'Confirmation shown after a server was turned on, where {name} is its name.',
  },
  turnedOff: {
    id: 'integration.turnedOff',
    defaultMessage: '{name} turned off',
    description: 'Confirmation shown after a server was turned off, where {name} is its name.',
  },
  toggleError: {
    id: 'integration.toggleError',
    defaultMessage: '{name} could not be changed. Try again.',
    description: 'Error shown when turning a server on or off failed, where {name} is its name.',
  },
  neverUsed: {
    id: 'integration.neverUsed',
    defaultMessage: 'Never',
    description: 'In the "Last used" column, for a server Strategy Dance never called.',
  },
  lastUsedJustNow: {
    id: 'integration.lastUsedJustNow',
    defaultMessage: 'Just now',
    description: 'In the "Last used" column, for a server Strategy Dance called less than a minute ago.',
  },
  galleryTitle: {
    id: 'integration.galleryTitle',
    defaultMessage: 'Add a server',
    description: 'Title of the section of the Integrations page listing popular MCP servers to add in a click.',
  },
  galleryDescription: {
    id: 'integration.galleryDescription',
    defaultMessage: 'Popular MCP servers. To add another one, use Add server and paste its URL.',
    description:
      'Text under the title of the section listing popular MCP servers. "Add server" is the name of the button that adds a server by its address.',
  },
  addCatalogueServer: {
    id: 'integration.addCatalogueServer',
    defaultMessage: 'Add {name}',
    description:
      'Accessible label of a tile of the gallery, and title of the dialog it opens, where {name} is a popular server\'s name, such as "Linear".',
  },
  categoryPayments: {
    id: 'integration.categoryPayments',
    defaultMessage: 'Payments',
    description: "Heading of the gallery's group of servers that take money: payments, subscriptions, a shop.",
  },
  categoryFinance: {
    id: 'integration.categoryFinance',
    defaultMessage: 'Finance',
    description:
      "Heading of the gallery's group of servers about the money a company holds and spends: its bank, its cards.",
  },
  categoryDevelopment: {
    id: 'integration.categoryDevelopment',
    defaultMessage: 'Development',
    description: "Heading of the gallery's group of servers about code, its errors, its databases and its hosting.",
  },
  categoryProjects: {
    id: 'integration.categoryProjects',
    defaultMessage: 'Projects',
    description: "Heading of the gallery's group of servers for planning work: issues, tasks and boards.",
  },
  categoryDocuments: {
    id: 'integration.categoryDocuments',
    defaultMessage: 'Documents',
    description:
      "Heading of the gallery's group of servers holding what a team writes and keeps: documents, notes, files, forms.",
  },
  categoryDesign: {
    id: 'integration.categoryDesign',
    defaultMessage: 'Design',
    description: "Heading of the gallery's group of servers for designs, whiteboards and websites.",
  },
  categoryMarketing: {
    id: 'integration.categoryMarketing',
    defaultMessage: 'Marketing',
    description:
      "Heading of the gallery's group of servers for reaching people: email, newsletters, social media, ads, search.",
  },
  categoryAnalytics: {
    id: 'integration.categoryAnalytics',
    defaultMessage: 'Analytics',
    description: "Heading of the gallery's group of servers that read what users do in a product.",
  },
  categoryCustomers: {
    id: 'integration.categoryCustomers',
    defaultMessage: 'Customers',
    description:
      "Heading of the gallery's group of servers about the people a company sells to and helps: CRM, bookings, support.",
  },
  categoryAutomation: {
    id: 'integration.categoryAutomation',
    defaultMessage: 'Automation',
    description: "Heading of the gallery's group of servers that act across other apps.",
  },
  categoryCommunication: {
    id: 'integration.categoryCommunication',
    defaultMessage: 'Communication',
    description: "Heading of the gallery's group of servers for talking to people: email, calls, texts.",
  },
  categoryPeople: {
    id: 'integration.categoryPeople',
    defaultMessage: 'People',
    description: "Heading of the gallery's group of servers about a company's team: hiring, payroll, time off.",
  },
  dialogAddTitle: {
    id: 'integration.dialogAddTitle',
    defaultMessage: 'Add MCP server',
    description: 'Title of the dialog for adding an MCP server by its address. Keep "MCP" as it is.',
  },
  dialogAddDescription: {
    id: 'integration.dialogAddDescription',
    defaultMessage: "Strategy Dance can call its tools in conversations once it's connected.",
    description: 'Explanation under the title of the dialog for adding a server.',
  },
  dialogDescription: {
    id: 'integration.dialogDescription',
    defaultMessage: '{host} · {authentication} · Last used {lastUsed}',
    description:
      'Line under the name of a server in its dialog, where {host} is its address\'s host, such as "mcp.stripe.com", {authentication} how it lets Strategy Dance in, such as "OAuth", and {lastUsed} when it was last called, such as "5 min ago" or "never".',
  },
  nameLabel: {
    id: 'integration.nameLabel',
    defaultMessage: 'Name',
    description: "Label of the field holding a server's name in its dialog.",
  },
  namePlaceholder: {
    id: 'integration.namePlaceholder',
    defaultMessage: 'Notion',
    description:
      "Example shown in the empty name field of a server's dialog: a well-known product. Keep it a product's name.",
  },
  nameRequired: {
    id: 'integration.nameRequired',
    defaultMessage: 'Enter a name.',
    description: "Error under the name field of a server's dialog when it is empty.",
  },
  nameInvalid: {
    id: 'integration.nameInvalid',
    defaultMessage: 'Use one line of at most 40 characters.',
    description: "Error under the name field of a server's dialog when the name is too long or holds a line break.",
  },
  nameTaken: {
    id: 'integration.nameTaken',
    defaultMessage: 'A server with this name already exists.',
    description:
      "Error under the name field of a server's dialog when another server of the organization has that name.",
  },
  urlLabel: {
    id: 'integration.urlLabel',
    defaultMessage: 'Server URL',
    description: "Label of the field holding a server's address in its dialog.",
  },
  urlHint: {
    id: 'integration.urlHint',
    defaultMessage:
      'Streamable HTTP endpoint of the MCP server. Every member sees it, so put a key in the API key field.',
    description:
      'Help under the address field of a server\'s dialog. "Streamable HTTP" and "MCP" are technical names to keep as they are; "API key" names the field for a secret key, which must not go in the address.',
  },
  urlInvalid: {
    id: 'integration.urlInvalid',
    defaultMessage: 'Enter an https:// address, without a port or a #.',
    description:
      "Error under the address field of a server's dialog when it is not an https address Strategy Dance reaches.",
  },
  authenticationLabel: {
    id: 'integration.authenticationLabel',
    defaultMessage: 'Authentication',
    description: "Label of the choice of how a server lets Strategy Dance in, in the server's dialog.",
  },
  apiKeyLabel: {
    id: 'integration.apiKeyLabel',
    defaultMessage: 'API key',
    description: "Label of the field holding the secret key a server takes, in the server's dialog.",
  },
  apiKeyKeepHint: {
    id: 'integration.apiKeyKeepHint',
    defaultMessage: 'Leave empty to keep the current key, ending in {lastFour}.',
    description:
      'Help under the key field of a server that has a key, where {lastFour} is the last four characters of that key, such as "4f2a".',
  },
  apiKeyKeepHintShort: {
    id: 'integration.apiKeyKeepHintShort',
    defaultMessage: 'Leave empty to keep the current key.',
    description: 'Help under the key field of a server that has a key too short for any part of it to be shown.',
  },
  apiKeyRequired: {
    id: 'integration.apiKeyRequired',
    defaultMessage: 'Enter an API key.',
    description: "Error under the key field of a server's dialog when a key is needed and none was typed.",
  },
  apiKeyRequiredAgain: {
    id: 'integration.apiKeyRequiredAgain',
    defaultMessage: 'Enter the key again: a key is never sent to another address.',
    description:
      'Error under the key field of a server whose address or authentication changed: the key stored for the old address is not kept.',
  },
  apiKeyInvalid: {
    id: 'integration.apiKeyInvalid',
    defaultMessage: 'Paste the key as the service gave it, on one line.',
    description:
      "Error under the key field of a server's dialog when the key holds a line break or characters a key cannot.",
  },
  apiKeySchemeLabel: {
    id: 'integration.apiKeySchemeLabel',
    defaultMessage: 'Send the key',
    description: "Label of the choice of how the key is sent to the server, in the server's dialog.",
  },
  apiKeySchemeBearer: {
    id: 'integration.apiKeySchemeBearer',
    defaultMessage: 'As a Bearer token',
    description:
      'Choice of sending the key in the "Authorization: Bearer" header, which most servers expect. Keep "Bearer" as it is.',
  },
  apiKeySchemeHeader: {
    id: 'integration.apiKeySchemeHeader',
    defaultMessage: 'In a header of its own',
    description: 'Choice of sending the key alone in a header the administrator names, such as "X-API-Key".',
  },
  apiKeyHeaderLabel: {
    id: 'integration.apiKeyHeaderLabel',
    defaultMessage: 'Header',
    description: 'Label of the field naming the header the key is sent in.',
  },
  apiKeyHeaderInvalid: {
    id: 'integration.apiKeyHeaderInvalid',
    defaultMessage: 'Name a header that can carry a key, such as X-API-Key.',
    description:
      'Error under the header field when it is empty, not a header name, or one the browser or the protocol sets itself. Keep "X-API-Key" as it is.',
  },
  close: {
    id: 'integration.close',
    defaultMessage: 'Close',
    description: "Accessible label of the button closing a server's dialog.",
  },
  cancel: {
    id: 'integration.cancel',
    defaultMessage: 'Cancel',
    description: "Button closing a server's dialog without saving.",
  },
  save: {
    id: 'integration.save',
    defaultMessage: 'Save',
    description: "Button saving the changes made in a server's dialog.",
  },
  delete: {
    id: 'integration.delete',
    defaultMessage: 'Delete',
    description: "Button in a server's dialog that removes the server, which asks to be clicked again to confirm.",
  },
  deleteConfirm: {
    id: 'integration.deleteConfirm',
    defaultMessage: 'Confirm delete',
    description: "What the Delete button of a server's dialog reads after a first click, until it is clicked again.",
  },
  retry: {
    id: 'integration.retry',
    defaultMessage: 'Retry',
    description: 'Button reaching a server again after it failed, in the error shown in its dialog.',
  },
  added: {
    id: 'integration.added',
    defaultMessage: '{name} added',
    description: 'Confirmation shown after a server was added, where {name} is its name.',
  },
  addedWithTools: {
    id: 'integration.addedWithTools',
    defaultMessage: '{name} added · {count, plural, one {# tool} other {# tools}}',
    description:
      'Confirmation shown after a server was added, where {name} is its name and {count} how many tools it lists.',
  },
  saved: {
    id: 'integration.saved',
    defaultMessage: 'Changes saved',
    description: "Confirmation shown after a server's dialog saved its changes.",
  },
  deleted: {
    id: 'integration.deleted',
    defaultMessage: '{name} removed',
    description: 'Confirmation shown after a server was deleted, with an Undo button, where {name} is its name.',
  },
  undo: {
    id: 'integration.undo',
    defaultMessage: 'Undo',
    description: 'Button in the confirmation of a deleted server that brings it back.',
  },
  deleteError: {
    id: 'integration.deleteError',
    defaultMessage: '{name} could not be deleted. Try again.',
    description: 'Error shown when deleting a server failed, where {name} is its name.',
  },
  restoreError: {
    id: 'integration.restoreError',
    defaultMessage: '{name} could not be brought back.',
    description: 'Error shown when the Undo of a deleted server failed, where {name} is its name.',
  },
  reachable: {
    id: 'integration.reachable',
    defaultMessage: '{name} is reachable again',
    description: 'Confirmation shown after a server that had failed answered a retry, where {name} is its name.',
  },
  failureAddressRefused: {
    id: 'integration.failureAddressRefused',
    defaultMessage: "Strategy Dance can't reach this address. Use a public https:// address.",
    description: 'Why a server could not be added or reached: its address is private, or not https.',
  },
  failureUnreachable: {
    id: 'integration.failureUnreachable',
    defaultMessage: 'Nothing answered at this address. Check it and try again.',
    description: 'Why a server could not be added or reached: nothing answered, or it answered with a server error.',
  },
  failureTimedOut: {
    id: 'integration.failureTimedOut',
    defaultMessage: 'The server took too long to answer. Try again.',
    description: 'Why a server could not be added or reached: it did not answer in time.',
  },
  failureKeyRefused: {
    id: 'integration.failureKeyRefused',
    defaultMessage: 'The server refused this key.',
    description: 'Why a server could not be added or reached: it refused the API key it was sent.',
  },
  failureAuthenticationRequired: {
    id: 'integration.failureAuthenticationRequired',
    defaultMessage: 'The server asks for authentication. Choose OAuth or API key.',
    description:
      'Why a server added without authentication could not be reached: it asks for some. "OAuth" and "API key" are the names of the choices of the Authentication field.',
  },
  failureNotMcpServer: {
    id: 'integration.failureNotMcpServer',
    defaultMessage: "This address doesn't answer as an MCP server.",
    description: 'Why a server could not be added or reached: what answered is not an MCP server. Keep "MCP" as it is.',
  },
  failureDiscoveryFailed: {
    id: 'integration.failureDiscoveryFailed',
    defaultMessage: "Strategy Dance can't set up signing in to this server.",
    description:
      'Why a server taking OAuth could not be added: its sign-in could not be found, or offers no way for Strategy Dance to register.',
  },
  failureTooManyTools: {
    id: 'integration.failureTooManyTools',
    defaultMessage: 'The server lists more tools than Strategy Dance can keep.',
    description: 'Why a server could not be added or reached: it lists too many tools.',
  },
  failureFull: {
    id: 'integration.failureFull',
    defaultMessage: 'Your organization has as many servers as it can. Delete one first.',
    description: 'Why a server could not be added or brought back: the organization reached its limit of servers.',
  },
  failureConflict: {
    id: 'integration.failureConflict',
    defaultMessage: 'Somebody changed this server meanwhile. Look again, then retry.',
    description:
      "Why a server's changes could not be saved: another administrator changed it while the dialog was open.",
  },
  failureGone: {
    id: 'integration.failureGone',
    defaultMessage: 'This server no longer exists.',
    description: 'Why a server could not be changed: it was deleted meanwhile.',
  },
  failureKeyUnavailable: {
    id: 'integration.failureKeyUnavailable',
    defaultMessage: "The key can't be stored right now. Try again later.",
    description: 'Why a server taking a key could not be saved: the key could not be encrypted for storage just now.',
  },
  failureRateLimited: {
    id: 'integration.failureRateLimited',
    defaultMessage: 'Too many servers reached in a short time. Try again in a few minutes.',
    description:
      'Why a server could not be added, changed or retried: the reader did too many of these in a few minutes.',
  },
  failureUnknown: {
    id: 'integration.failureUnknown',
    defaultMessage: 'Something went wrong. Try again.',
    description: 'Why a server could not be added, changed or retried, when nothing more precise is known.',
  },
  toolsTitle: {
    id: 'integration.toolsTitle',
    defaultMessage: 'Tools',
    description: "Heading of the list of the tools a server offers, in the server's dialog.",
  },
  toolsCount: {
    id: 'integration.toolsCount',
    defaultMessage: '{count, plural, one {# tool} other {# tools}}',
    description: "How many tools a server lists, beside the server's address in the servers table on small screens.",
  },
  toolsWaiting: {
    id: 'integration.toolsWaiting',
    defaultMessage: "Connect an account to list this server's tools.",
    description:
      'Shown in place of the tools of a server taking OAuth, whose tools are listed once a member signs in to it with their own account.',
  },
  toolsEmpty: {
    id: 'integration.toolsEmpty',
    defaultMessage: 'This server lists no tools.',
    description: 'Shown in place of the tools of a server that lists none.',
  },
  toolsLoadError: {
    id: 'integration.toolsLoadError',
    defaultMessage: "The server's tools could not be loaded.",
    description: "Error shown in place of a server's tools when they could not be read.",
  },
  toolsApprovalWarning: {
    id: 'integration.toolsApprovalWarning',
    defaultMessage:
      'A tool that runs without approval can be called at once, with any arguments, by anything Strategy Dance reads, such as a web page or a document. Allow only tools whose effects you accept.',
    description:
      "Warning above the switches that let a server's tools run without a member approving each call, since text Strategy Dance reads could get such a tool called.",
  },
  runWithoutApproval: {
    id: 'integration.runWithoutApproval',
    defaultMessage: 'Run {tool} without approval',
    description:
      'Accessible label of the switch letting a tool run without a member approving each call, where {tool} is the tool\'s name, such as "create_issue".',
  },
  runsWithoutApproval: {
    id: 'integration.runsWithoutApproval',
    defaultMessage: '{tool} now runs without approval',
    description: 'Confirmation shown after a tool was let run without approval, where {tool} is its name.',
  },
  asksForApproval: {
    id: 'integration.asksForApproval',
    defaultMessage: '{tool} asks for approval again',
    description: 'Confirmation shown after a tool was set back to asking for approval, where {tool} is its name.',
  },
  approvalError: {
    id: 'integration.approvalError',
    defaultMessage: '{tool} could not be changed. Try again.',
    description: 'Error shown when changing whether a tool runs without approval failed, where {tool} is its name.',
  },
  readOnlyClaim: {
    id: 'integration.readOnlyClaim',
    defaultMessage: 'Read only, says the server',
    description:
      "Small label beside a tool the server says only reads. It is the server's own claim, which may be wrong, so it decides nothing.",
  },
  readOnlyClaimHint: {
    id: 'integration.readOnlyClaimHint',
    defaultMessage: 'The server says this tool only reads. A server can be wrong, so this decides nothing.',
    description: 'Tooltip on the "Read only, says the server" label of a tool.',
  },
})

export default integrationMessages
