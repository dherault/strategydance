import { defineMessages } from 'react-intl'

/*
  Strategy Dance's modules as a member sees them: what each is called and what each access lets an
  agent do, and the consent page where a member allows an external agent to use one. Registered
  app-wide, since the account page reads it, and on the consent page, which sits outside the app
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
})

export default moduleMessages
