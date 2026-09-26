import { defineMessages } from 'react-intl'

// The authenticated area's frame: its sidebar, its menus, and the pages that are not built yet
const navigationMessages = defineMessages({
  sidebar: {
    id: 'navigation.sidebar',
    defaultMessage: 'Navigation',
    description: 'Accessible name of the sidebar when it opens as a panel on a narrow screen.',
  },
  toggleSidebar: {
    id: 'navigation.toggleSidebar',
    defaultMessage: 'Toggle the sidebar',
    description: 'Accessible label of the button that shows or hides the sidebar.',
  },
  closeSidebar: {
    id: 'navigation.closeSidebar',
    defaultMessage: 'Close the sidebar',
    description: 'Accessible label of the button that closes the sidebar when it opens as a panel on a narrow screen.',
  },
  today: {
    id: 'navigation.today',
    defaultMessage: 'Today',
    description: 'Sidebar link to the page about what to do today.',
  },
  tasks: {
    id: 'navigation.tasks',
    defaultMessage: 'Tasks',
    description: 'Sidebar link to the list of tasks.',
  },
  agents: {
    id: 'navigation.agents',
    defaultMessage: 'Agents',
    description: 'Sidebar link to the page about the AI agents working for the company.',
  },
  aspects: {
    id: 'navigation.aspects',
    defaultMessage: 'Aspects',
    description: 'Sidebar heading above the aspects of the company, such as strategy or finances.',
  },
  exploreMore: {
    id: 'navigation.exploreMore',
    defaultMessage: 'Explore more aspects',
    description: 'Sidebar link to the page where the reader adds more aspects of their company to work on.',
  },
  company: {
    id: 'navigation.company',
    defaultMessage: 'Company',
    description: 'Sidebar heading above the links about the company itself, such as its team and its settings. Also the small label above the title of those pages.',
  },
  team: {
    id: 'navigation.team',
    defaultMessage: 'Team',
    description: 'Sidebar link to the page about the people in the organization.',
  },
  settings: {
    id: 'navigation.settings',
    defaultMessage: 'Settings',
    description: 'Sidebar link to the settings page.',
  },
  aspectStrategy: {
    id: 'navigation.aspectStrategy',
    defaultMessage: 'Strategy',
    description: 'Name of the strategy aspect of a company.',
  },
  aspectPeople: {
    id: 'navigation.aspectPeople',
    defaultMessage: 'People and operations',
    description: 'Name of the aspect of a company about its people and how work gets done.',
  },
  aspectFinances: {
    id: 'navigation.aspectFinances',
    defaultMessage: 'Finances',
    description: 'Name of the finances aspect of a company.',
  },
  aspectProduct: {
    id: 'navigation.aspectProduct',
    defaultMessage: 'Product',
    description: 'Name of the product aspect of a company: what it builds.',
  },
  aspectEngineering: {
    id: 'navigation.aspectEngineering',
    defaultMessage: 'Engineering',
    description: 'Name of the engineering aspect of a company.',
  },
  aspectDesign: {
    id: 'navigation.aspectDesign',
    defaultMessage: 'Design',
    description: 'Name of the design aspect of a company.',
  },
  aspectMarketing: {
    id: 'navigation.aspectMarketing',
    defaultMessage: 'Marketing',
    description: 'Name of the marketing aspect of a company.',
  },
  aspectSales: {
    id: 'navigation.aspectSales',
    defaultMessage: 'Sales',
    description: 'Name of the sales aspect of a company.',
  },
  aspectLegal: {
    id: 'navigation.aspectLegal',
    defaultMessage: 'Legal',
    description: 'Name of the legal aspect of a company.',
  },
  organizations: {
    id: 'navigation.organizations',
    defaultMessage: 'Organizations',
    description: 'Heading of the menu listing the reader\'s organizations.',
  },
  noOrganization: {
    id: 'navigation.noOrganization',
    defaultMessage: 'No organization yet',
    description: 'Shown in place of the current organization\'s name when the reader belongs to none.',
  },
  addOrganization: {
    id: 'navigation.addOrganization',
    defaultMessage: 'Add organization',
    description: 'Menu item that opens the form creating a new organization.',
  },
  addOrganizationTitle: {
    id: 'navigation.addOrganizationTitle',
    defaultMessage: 'Add an organization',
    description: 'Title of the window creating a new organization.',
  },
  addOrganizationDescription: {
    id: 'navigation.addOrganizationDescription',
    defaultMessage: 'An organization holds a company and the people working on it.',
    description: 'Explanation under the title of the window creating a new organization.',
  },
  organizationName: {
    id: 'navigation.organizationName',
    defaultMessage: 'Name',
    description: 'Label of the field for the new organization\'s name.',
  },
  addOrganizationSubmit: {
    id: 'navigation.addOrganizationSubmit',
    defaultMessage: 'Add',
    description: 'Button that creates the organization.',
  },
  addOrganizationError: {
    id: 'navigation.addOrganizationError',
    defaultMessage: 'The organization could not be created. Try again.',
    description: 'Error shown under the name field when creating the organization failed.',
  },
  close: {
    id: 'navigation.close',
    defaultMessage: 'Close',
    description: 'Accessible label of the button that closes a window.',
  },
  account: {
    id: 'navigation.account',
    defaultMessage: 'Account',
    description: 'User menu item leading to the reader\'s account.',
  },
  support: {
    id: 'navigation.support',
    defaultMessage: 'Support',
    description: 'User menu item leading to help and support.',
  },
  logOut: {
    id: 'navigation.logOut',
    defaultMessage: 'Log out',
    description: 'User menu item that signs the reader out.',
  },
  githubStar: {
    id: 'navigation.githubStar',
    defaultMessage: 'Star',
    description: 'Label of the button that stars the project\'s repository on GitHub, as GitHub itself words it.',
  },
  githubStarLabel: {
    id: 'navigation.githubStarLabel',
    defaultMessage: 'Star {repository} on GitHub',
    description: 'Accessible label of the button that stars the project\'s repository on GitHub. {repository} is the repository\'s name, such as dherault/strategydance, and stays as is.',
  },
  githubStargazers: {
    id: 'navigation.githubStargazers',
    defaultMessage: '{count, plural, one {# stargazer} other {# stargazers}} on GitHub',
    description: 'Accessible label of the count of people who starred the project on GitHub.',
  },
  comingSoon: {
    id: 'navigation.comingSoon',
    defaultMessage: 'Coming soon',
    description: 'Title of the notice on a page that is not built yet.',
  },
  comingSoonDescription: {
    id: 'navigation.comingSoonDescription',
    defaultMessage: '{page} is on its way.',
    description: 'Text of the notice on a page that is not built yet. {page} is the page\'s name, such as Tasks.',
  },
})

export default navigationMessages
