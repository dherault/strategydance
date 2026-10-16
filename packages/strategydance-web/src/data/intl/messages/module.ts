import { defineMessages } from 'react-intl'

/*
  Strategy Dance's modules as a member sees them: what each is called and what each access lets an
  agent do, the consent page where a member allows an external agent to use one, the account page's
  Connected agents tab, and the button on a module's page and the dialog it opens to tell how to
  connect one. Registered app-wide, since the account page reads it, and on the consent page, which
  sits outside the app
*/
const moduleMessages = defineMessages({
  knowledgeName: {
    id: 'module.knowledgeName',
    defaultMessage: 'Knowledge',
    description: "The name of the module that lets an agent use the organization's knowledge documents.",
  },
  knowledgeReadAccess: {
    id: 'module.knowledgeReadAccess',
    defaultMessage: 'List, read and search the knowledge documents your organization lets agents read.',
    description:
      'What an agent allowed to read the Knowledge module can do. Each document has a setting saying whether agents may read it.',
  },
  knowledgeWriteAccess: {
    id: 'module.knowledgeWriteAccess',
    defaultMessage: 'Create, edit and delete knowledge documents, where your organization lets agents write.',
    description:
      'What an agent allowed to write in the Knowledge module can do, beside reading. Each document has a setting saying whether agents may change it.',
  },
  knowledgeAgentsButton: {
    id: 'module.knowledgeAgentsButton',
    defaultMessage: 'Allow your agents to read and write documents',
    description:
      "Tooltip and accessible name of the icon button on the Knowledge page that opens a dialog explaining how to connect an AI agent of the member's own, such as Claude or ChatGPT, to the organization's knowledge documents.",
  },
  tasksName: {
    id: 'module.tasksName',
    defaultMessage: 'Tasks',
    description: "The name of the module that lets an agent use the team's task board.",
  },
  tasksReadAccess: {
    id: 'module.tasksReadAccess',
    defaultMessage: "List and read the tasks on your team's board.",
    description: 'What an agent allowed to read the Tasks module can do.',
  },
  tasksWriteAccess: {
    id: 'module.tasksWriteAccess',
    defaultMessage: "Create, change, link and delete the tasks on your team's board.",
    description: 'What an agent allowed to write in the Tasks module can do, beside reading.',
  },
  tasksAgentsButton: {
    id: 'module.tasksAgentsButton',
    defaultMessage: 'Allow your agents to read and tackle tasks',
    description:
      "Tooltip and accessible name of the icon button on the Tasks page that opens a dialog explaining how to connect an AI agent of the member's own, such as Claude or ChatGPT, to the team's task board. To tackle a task is to take it up and work on it.",
  },
  readAccess: {
    id: 'module.readAccess',
    defaultMessage: 'Read',
    description: 'The access that lets an agent read a module but change nothing, as a short label.',
  },
  readWriteAccess: {
    id: 'module.readWriteAccess',
    defaultMessage: 'Read and write',
    description: 'The access that lets an agent read a module and change what is in it, as a short label.',
  },
  unnamedAgent: {
    id: 'module.unnamedAgent',
    defaultMessage: 'Unnamed agent',
    description:
      'What an external agent is called when it gave no name of its own, wherever its name would be, as in "Connect Unnamed agent to Knowledge".',
  },
  unverified: {
    id: 'module.unverified',
    defaultMessage: 'Unverified',
    description: 'Badge beside an external agent that registered itself, so Strategy Dance cannot confirm who made it.',
  },
  unverifiedHint: {
    id: 'module.unverifiedHint',
    defaultMessage: 'This agent registered itself, so Strategy Dance cannot confirm who made it.',
    description: 'Tooltip on the Unverified badge beside an external agent.',
  },
  agentDomain: {
    id: 'module.agentDomain',
    defaultMessage: 'From {domain}',
    description:
      'Under an external agent\'s name, the web domain that vouches for it, such as "From claude.ai". {domain} is a domain name.',
  },
  consentEyebrow: {
    id: 'module.consentEyebrow',
    defaultMessage: 'Connect an agent',
    description:
      'Small label above the title of the page where a member allows an external agent, such as Claude or ChatGPT, to use a module.',
  },
  consentTitle: {
    id: 'module.consentTitle',
    defaultMessage: 'Connect {agentName} to {moduleName}',
    description:
      'Title of the page where a member allows an external agent to use a module. {agentName} is the agent\'s name, such as "Claude". {moduleName} is the module\'s name, such as "Knowledge".',
  },
  consentLead: {
    id: 'module.consentLead',
    defaultMessage:
      'It will act as you in the organization you choose, with the access you allow, until you disconnect it from your account.',
    description: 'Explanation under the title of the page where a member allows an external agent to use a module.',
  },
  redirectHost: {
    id: 'module.redirectHost',
    defaultMessage: 'Once you answer, you will be sent back to <strong>{host}</strong>.',
    description:
      'On the page where a member allows an external agent, where the browser goes after they allow or deny it. {host} is a web address\'s host, such as "claude.ai". Keep the <strong> tags around it.',
  },
  loopbackTitle: {
    id: 'module.loopbackTitle',
    defaultMessage: 'This agent runs on your computer',
    description:
      'Title of a warning on the page where a member allows an external agent, when the agent asks to be sent back to an address on their own computer.',
  },
  loopbackWarning: {
    id: 'module.loopbackWarning',
    defaultMessage:
      'It asks to be sent back to <strong>{host}</strong>, on your own computer, where any program could be listening. Allow it only if you started this connection yourself, just now.',
    description:
      'Warning on the page where a member allows an external agent, when the agent asks to be sent back to an address on their own computer. {host} is that address, such as "127.0.0.1:43210". Keep the <strong> tags around it.',
  },
  organizationLabel: {
    id: 'module.organizationLabel',
    defaultMessage: 'Organization',
    description:
      'Label of the organization a member chooses for an external agent to act in, on the page where they allow it.',
  },
  accessLabel: {
    id: 'module.accessLabel',
    defaultMessage: 'Access',
    description:
      'Label of what an external agent may do in a module, read or read and write, on the page where a member allows it.',
  },
  allow: {
    id: 'module.allow',
    defaultMessage: 'Allow',
    description: 'Button that allows an external agent to use a module as the member.',
  },
  deny: {
    id: 'module.deny',
    defaultMessage: 'Deny',
    description: 'Button that refuses to let an external agent use a module.',
  },
  fullTitle: {
    id: 'module.fullTitle',
    defaultMessage: 'You connected as many agents as you can',
    description:
      'Title of a warning on the page where a member allows an external agent, when they already connected as many agents as Strategy Dance allows.',
  },
  fullDescription: {
    id: 'module.fullDescription',
    defaultMessage: 'You can connect up to {max} agents. Disconnect one you no longer use, then allow this one again.',
    description:
      'Warning on the page where a member allows an external agent, when they already connected as many agents as Strategy Dance allows. {max} is that number, such as 100.',
  },
  openConnectedAgents: {
    id: 'module.openConnectedAgents',
    defaultMessage: 'Open Connected agents',
    description:
      "Link, opening in a new tab, to the account page's Connected agents tab, where the member disconnects agents.",
  },
  decideError: {
    id: 'module.decideError',
    defaultMessage: 'Your answer could not be sent. Try again.',
    description: 'Error shown when allowing or denying an external agent failed.',
  },
  redirecting: {
    id: 'module.redirecting',
    defaultMessage: 'Sending you back to {host}…',
    description:
      'Shown while the browser leaves for the external agent\'s address, once the member allowed or denied it. {host} is a web address\'s host, such as "claude.ai".',
  },
  deniedTitle: {
    id: 'module.deniedTitle',
    defaultMessage: 'Connection denied',
    description: 'Title shown once a member refused to let an external agent use a module.',
  },
  deniedDescription: {
    id: 'module.deniedDescription',
    defaultMessage: '{agentName} was not connected. You can close this page.',
    description:
      "Shown once a member refused to let an external agent use a module, when the agent's address could not be told. {agentName} is the agent's name.",
  },
  expiredTitle: {
    id: 'module.expiredTitle',
    defaultMessage: 'This request has expired',
    description:
      'Title shown on the page where a member allows an external agent, when the request was answered already, waited too long, or never existed.',
  },
  expiredDescription: {
    id: 'module.expiredDescription',
    defaultMessage: 'It was answered already, or waited too long. Go back to your agent and connect it again.',
    description:
      'Shown on the page where a member allows an external agent, when the request was answered already, waited too long, or never existed.',
  },
  refusedTitle: {
    id: 'module.refusedTitle',
    defaultMessage: 'This agent could not be verified',
    description:
      'Title shown on the page where a member allows an external agent, when Strategy Dance could not confirm what the agent says about itself.',
  },
  refusedDescription: {
    id: 'module.refusedDescription',
    defaultMessage:
      'Strategy Dance could not confirm what this agent says about itself, so it cannot be connected. Try again later, or tell whoever makes it.',
    description:
      'Shown on the page where a member allows an external agent, when Strategy Dance could not confirm what the agent says about itself.',
  },
  unavailableTitle: {
    id: 'module.unavailableTitle',
    defaultMessage: 'Connecting agents is not available yet',
    description:
      'Title shown to a member who opens the page for allowing an external agent before the feature is open to them.',
  },
  unavailableDescription: {
    id: 'module.unavailableDescription',
    defaultMessage: 'Strategy Dance will soon let you connect agents such as Claude or ChatGPT to your organization.',
    description:
      'Shown to a member who opens the page for allowing an external agent before the feature is open to them.',
  },
  readError: {
    id: 'module.readError',
    defaultMessage: "The agent's request could not be read.",
    description:
      'Error shown on the page where a member allows an external agent, when the request could not be loaded. A retry button follows.',
  },
  noOrganizationTitle: {
    id: 'module.noOrganizationTitle',
    defaultMessage: 'You are in no organization yet',
    description:
      'Title shown on the page where a member allows an external agent, when they belong to no organization the agent could act in.',
  },
  noOrganizationDescription: {
    id: 'module.noOrganizationDescription',
    defaultMessage:
      'An agent acts as you in one of your organizations. Create one or join one, then connect the agent again.',
    description:
      'Shown on the page where a member allows an external agent, when they belong to no organization the agent could act in.',
  },
  createOrganization: {
    id: 'module.createOrganization',
    defaultMessage: 'Create an organization',
    description:
      'Link to the onboarding, on the page where a member allows an external agent, when they belong to no organization yet.',
  },
  connectedAgentsTab: {
    id: 'module.connectedAgentsTab',
    defaultMessage: 'Connected agents',
    description:
      'Tab of the account page listing the external agents, such as Claude or ChatGPT, the member allowed to act as them.',
  },
  connectedAgentsLead: {
    id: 'module.connectedAgentsLead',
    defaultMessage: 'The agents you allowed to act as you. Disconnecting one stops it at once.',
    description: "Explanation at the top of the account page's Connected agents tab.",
  },
  connectedAgentsEmptyTitle: {
    id: 'module.connectedAgentsEmptyTitle',
    defaultMessage: 'No agents connected',
    description: "Title shown on the account page's Connected agents tab when the member connected none.",
  },
  connectedAgentsEmptyDescription: {
    id: 'module.connectedAgentsEmptyDescription',
    defaultMessage: 'When you allow an agent such as Claude or ChatGPT to use a module, it shows here.',
    description: "Shown on the account page's Connected agents tab when the member connected none.",
  },
  connectedAgentsLoadError: {
    id: 'module.connectedAgentsLoadError',
    defaultMessage: 'Your connected agents could not be loaded.',
    description:
      "Error shown on the account page's Connected agents tab when the list could not be read. A retry button follows.",
  },
  connectionModule: {
    id: 'module.connectionModule',
    defaultMessage: '{moduleName} · {access}',
    description:
      'On a connected agent, the module it may use and its access, such as "Knowledge · Read and write". {moduleName} is the module\'s name and {access} the access\'s short label.',
  },
  connectedOn: {
    id: 'module.connectedOn',
    defaultMessage: 'Connected {date}',
    description: 'When the member connected an external agent. {date} is a short date, such as "Sep 3".',
  },
  lastUsedJustNow: {
    id: 'module.lastUsedJustNow',
    defaultMessage: 'Last used just now',
    description: 'When a connected agent last used its module, when that was less than a minute ago.',
  },
  lastUsedAgo: {
    id: 'module.lastUsedAgo',
    defaultMessage: 'Last used {time}',
    description:
      'When a connected agent last used its module. {time} is a relative time from the browser, such as "5 minutes ago", "yesterday" or "3 days ago".',
  },
  lastUsedOn: {
    id: 'module.lastUsedOn',
    defaultMessage: 'Last used {date}',
    description:
      'When a connected agent last used its module, when that was over a week ago. {date} is a short date, such as "Sep 3".',
  },
  neverUsed: {
    id: 'module.neverUsed',
    defaultMessage: 'Not used yet',
    description: 'Shown on a connected agent that has not used its module since the member connected it.',
  },
  disconnect: {
    id: 'module.disconnect',
    defaultMessage: 'Disconnect',
    description:
      'Button that disconnects an external agent, which stops it acting as the member. It asks to be clicked a second time.',
  },
  disconnectConfirm: {
    id: 'module.disconnectConfirm',
    defaultMessage: 'Disconnect?',
    description: 'What the Disconnect button says once clicked, asking to be clicked again to disconnect the agent.',
  },
  disconnected: {
    id: 'module.disconnected',
    defaultMessage: '{agentName} was disconnected',
    description: "Message shown once an external agent was disconnected. {agentName} is the agent's name.",
  },
  disconnectError: {
    id: 'module.disconnectError',
    defaultMessage: '{agentName} could not be disconnected',
    description: "Error shown when disconnecting an external agent failed. {agentName} is the agent's name.",
  },
  agentsTitle: {
    id: 'module.agentsTitle',
    defaultMessage: 'Use {module} with your agents',
    description:
      'Title of the dialog explaining how to connect an AI agent of the member\'s own to a module. {module} is the module\'s name, such as "Knowledge".',
  },
  agentsDescription: {
    id: 'module.agentsDescription',
    defaultMessage:
      'Add this address to an AI agent of your own, such as Claude, ChatGPT or Cursor. It asks you to sign in and allow it, then acts as you, within what your organization lets agents do.',
    description:
      "Lead of the dialog explaining how to connect an AI agent of the member's own to a module. Claude, ChatGPT and Cursor are product names, kept as they are.",
  },
  agentsAddress: {
    id: 'module.agentsAddress',
    defaultMessage: 'Address',
    description: "Label of the module's web address, which the member adds to their agent, in the agents dialog.",
  },
  agentsCopyAddress: {
    id: 'module.agentsCopyAddress',
    defaultMessage: 'Copy the address',
    description: "Accessible name and tooltip of the button that copies the module's address in the agents dialog.",
  },
  agentsCopySetup: {
    id: 'module.agentsCopySetup',
    defaultMessage: 'Copy',
    description:
      'Accessible name and tooltip of the button that copies a command or a configuration to paste into an agent, in the agents dialog.',
  },
  agentsCopied: {
    id: 'module.agentsCopied',
    defaultMessage: 'Copied',
    description: 'What a copy button in the agents dialog says for a moment once it has copied.',
  },
  agentsClaude: {
    id: 'module.agentsClaude',
    defaultMessage: 'Claude',
    description:
      "Heading of the steps for Claude's apps, on the web, desktop and phone. A product name, kept as it is.",
  },
  agentsClaudeSteps: {
    id: 'module.agentsClaudeSteps',
    defaultMessage: 'In Settings, open Connectors, choose Add custom connector and paste the address.',
    description:
      'How to connect a module in Claude\'s apps. "Settings", "Connectors" and "Add custom connector" are the names Claude shows in English.',
  },
  agentsChatGpt: {
    id: 'module.agentsChatGpt',
    defaultMessage: 'ChatGPT',
    description: 'Heading of the steps for ChatGPT. A product name, kept as it is.',
  },
  agentsChatGptSteps: {
    id: 'module.agentsChatGptSteps',
    defaultMessage:
      'In Settings, open Apps and Connectors, turn on developer mode in its advanced settings, then create a connector with the address.',
    description:
      'How to connect a module in ChatGPT, whose custom connectors need its developer mode. "Settings" and "Apps and Connectors" are the names ChatGPT shows in English.',
  },
  agentsClaudeCode: {
    id: 'module.agentsClaudeCode',
    defaultMessage: 'Claude Code',
    description: 'Heading of the steps for Claude Code, a coding agent. A product name, kept as it is.',
  },
  agentsClaudeCodeSteps: {
    id: 'module.agentsClaudeCodeSteps',
    defaultMessage: 'Run this in a terminal, then sign in from /mcp in Claude Code.',
    description:
      'How to connect a module in Claude Code, followed by a command to run. "/mcp" is a command typed in Claude Code, kept as it is.',
  },
  agentsCursor: {
    id: 'module.agentsCursor',
    defaultMessage: 'Cursor',
    description: 'Heading of the steps for Cursor, a code editor. A product name, kept as it is.',
  },
  agentsCursorSteps: {
    id: 'module.agentsCursorSteps',
    defaultMessage: 'Add this server to the mcp.json file Cursor opens from its MCP settings.',
    description:
      'How to connect a module in Cursor, followed by the configuration to add. "mcp.json" is a file name, kept as it is.',
  },
  agentsManage: {
    id: 'module.agentsManage',
    defaultMessage: 'You can see and disconnect your agents in Connected agents, on your account.',
    description: "Closing line of the agents dialog, before a link to the account page's Connected agents tab.",
  },
  agentsOpenConnectedAgents: {
    id: 'module.agentsOpenConnectedAgents',
    defaultMessage: 'Open Connected agents',
    description: "Link from the agents dialog to the account page's tab listing the agents the member connected.",
  },
  agentsClose: {
    id: 'module.agentsClose',
    defaultMessage: 'Close',
    description: 'Accessible name of the button that closes the agents dialog.',
  },
})

export default moduleMessages
