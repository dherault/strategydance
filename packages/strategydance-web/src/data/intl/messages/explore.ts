import { defineMessages } from 'react-intl'

// The page where the reader picks which aspects of their company to work on
const exploreMessages = defineMessages({
  explored: {
    id: 'explore.explored',
    defaultMessage: '{explored} of {total} explored',
    description: 'Small label above the page title counting the aspects the organization works on, such as "5 of 9 explored".',
  },
  lead: {
    id: 'explore.lead',
    defaultMessage: 'Every company runs on the same nine aspects. Add the ones you want guidance on, and get ready to work.',
    description: 'Introduction under the title of the page listing the aspects of a company.',
  },
  blurbStrategy: {
    id: 'explore.blurbStrategy',
    defaultMessage: 'The challenge to tackle and the path to victory.',
    description: 'One-line description of the strategy aspect of a company.',
  },
  blurbPeople: {
    id: 'explore.blurbPeople',
    defaultMessage: 'Hiring, collaborators, routines and how work gets done.',
    description: 'One-line description of the people and operations aspect of a company.',
  },
  blurbFinances: {
    id: 'explore.blurbFinances',
    defaultMessage: 'Runway, pricing, revenue and monthly spend.',
    description: 'One-line description of the finances aspect of a company.',
  },
  blurbProduct: {
    id: 'explore.blurbProduct',
    defaultMessage: 'What you build, for whom, and what ships next.',
    description: 'One-line description of the product aspect of a company.',
  },
  blurbEngineering: {
    id: 'explore.blurbEngineering',
    defaultMessage: 'Define your MVP and keep iterating from there.',
    description: 'One-line description of the engineering aspect of a company. MVP means minimum viable product.',
  },
  blurbDesign: {
    id: 'explore.blurbDesign',
    defaultMessage: 'Brand, interface and the experience around your product.',
    description: 'One-line description of the design aspect of a company.',
  },
  blurbMarketing: {
    id: 'explore.blurbMarketing',
    defaultMessage: 'Audience, channels and a consistent publishing rhythm.',
    description: 'One-line description of the marketing aspect of a company.',
  },
  blurbSales: {
    id: 'explore.blurbSales',
    defaultMessage: 'Pipeline, outreach and closing your first customers.',
    description: 'One-line description of the sales aspect of a company.',
  },
  blurbLegal: {
    id: 'explore.blurbLegal',
    defaultMessage: 'Company structure, contracts, terms and compliance.',
    description: 'One-line description of the legal aspect of a company.',
  },
  open: {
    id: 'explore.open',
    defaultMessage: 'Open',
    description: 'Call to action at the bottom of an aspect the organization already works on, leading to its page.',
  },
  start: {
    id: 'explore.start',
    defaultMessage: 'Start exploration',
    description: 'Button that adds an aspect to those the organization works on.',
  },
  startError: {
    id: 'explore.startError',
    defaultMessage: 'The aspect could not be added. Try again.',
    description: 'Error shown when adding an aspect to those the organization works on failed.',
  },
  noOrganization: {
    id: 'explore.noOrganization',
    defaultMessage: 'Add an organization to start exploring its aspects.',
    description: 'Notice on the aspects page while the reader belongs to no organization, which aspects are added to.',
  },
})

export default exploreMessages
