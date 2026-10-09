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
    description: "Sidebar link to the board of tasks the team and Strategy Dance work on, and that page's title.",
  },
  buildInPublic: {
    id: 'navigation.buildInPublic',
    defaultMessage: 'Build in public',
    description:
      "Sidebar link to the page that turns the reader's progress into pictures to share on social networks, and that page's title. Building in public is sharing openly how a company is being built.",
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
  reflection: {
    id: 'navigation.reflection',
    defaultMessage: 'Reflection',
    description:
      "Sidebar heading above the links to the reader's conversations with Strategy Dance, the app's AI, and to the knowledge their team wrote down about its company.",
  },
  conversations: {
    id: 'navigation.conversations',
    defaultMessage: 'Conversations',
    description:
      "Sidebar link to the page that lists the reader's private conversations with Strategy Dance, the app's AI, and that page's title.",
  },
  conversationsAwaitingAnswer: {
    id: 'navigation.conversationsAwaitingAnswer',
    defaultMessage: '{count, plural, one {# conversation needs your answer} other {# conversations need your answer}}',
    description:
      "What a screen reader says after the Conversations link of the sidebar, where a small count shows how many of the reader's conversations hold a question from Strategy Dance, the app's AI, waiting for their answer.",
  },
  knowledge: {
    id: 'navigation.knowledge',
    defaultMessage: 'Knowledge',
    description:
      "Sidebar link to the page that lists everything the team wrote down about its company, such as notes, plans and decisions, and that page's title, and the title of the section of each aspect's page that lists the items tagged with that aspect.",
  },
  company: {
    id: 'navigation.company',
    defaultMessage: 'Company',
    description: 'Sidebar heading above the links about the company itself, such as its team and its profile.',
  },
  team: {
    id: 'navigation.team',
    defaultMessage: 'Team',
    description: 'Sidebar link to the page about the people in the organization.',
  },
  profile: {
    id: 'navigation.profile',
    defaultMessage: 'Profile',
    description:
      'Sidebar link, under the "Company" heading, to the page where administrators set how the organization appears to its team, the community and agents.',
  },
  administration: {
    id: 'navigation.administration',
    defaultMessage: 'Administration',
    description:
      "Sidebar heading above the links to the pages that administer the whole product, shown only to its own administrators. Also the small label above those pages' titles.",
  },
  administrationUsers: {
    id: 'navigation.administrationUsers',
    defaultMessage: 'Users',
    description:
      'Sidebar link, under the "Administration" heading, to the page listing every account on the product. Also that page\'s title.',
  },
  administrationOrganizations: {
    id: 'navigation.administrationOrganizations',
    defaultMessage: 'Organizations',
    description:
      'Sidebar link, under the "Administration" heading, to the page listing every organization on the product. Also that page\'s title.',
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
  chapter: {
    id: 'navigation.chapter',
    defaultMessage: 'Chapter {number}',
    description:
      'Small heading above an aspect\'s name, such as "Chapter 3" above "Sales", on the full screen shown when the organization starts working on that aspect. {number} is the aspect\'s place among the nine.',
  },
  organizations: {
    id: 'navigation.organizations',
    defaultMessage: 'Organizations',
    description: "Heading of the menu listing the reader's organizations.",
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
    description: "Label of the field for the new organization's name.",
  },
  organizationBrief: {
    id: 'navigation.organizationBrief',
    defaultMessage: 'Brief',
    description: "Label of the field for a short description of the new organization's company.",
  },
  organizationBriefPlaceholder: {
    id: 'navigation.organizationBriefPlaceholder',
    defaultMessage: 'What your company does, for whom, and where it is headed.',
    description: 'Placeholder in the empty brief field of the window creating a new organization.',
  },
  organizationBriefHint: {
    id: 'navigation.organizationBriefHint',
    defaultMessage: 'You can edit this later in your company profile.',
    description: 'Hint under the brief field of the window creating a new organization.',
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
  addOrganizationUnread: {
    id: 'navigation.addOrganizationUnread',
    defaultMessage: '{organizationName} was created, but it could not be loaded. Reload the page to see it.',
    description:
      'Error shown once the window creating an organization closes, when the organization was created but the list of organizations could not be refreshed.',
  },
  close: {
    id: 'navigation.close',
    defaultMessage: 'Close',
    description: 'Accessible label of the button that closes a window.',
  },
  account: {
    id: 'navigation.account',
    defaultMessage: 'Account',
    description: "User menu item leading to the reader's account.",
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
    description: "Label of the button that stars the project's repository on GitHub, as GitHub itself words it.",
  },
  githubStarLabel: {
    id: 'navigation.githubStarLabel',
    defaultMessage: 'Star {repository} on GitHub',
    description:
      "Accessible label of the button that stars the project's repository on GitHub. {repository} is the repository's name, such as dherault/strategydance, and stays as is.",
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
    description: "Text of the notice on a page that is not built yet. {page} is the page's name, such as Today.",
  },
  organizationNotFoundTitle: {
    id: 'navigation.organizationNotFoundTitle',
    defaultMessage: 'Organization not found',
    description:
      'Title of the page shown when the address names an organization the reader does not belong to, or one that does not exist.',
  },
  organizationNotFoundText: {
    id: 'navigation.organizationNotFoundText',
    defaultMessage:
      'It may have been deleted, or you may not be a member of it. Check the address, or ask one of its administrators to invite you.',
    description:
      'Text under the title of the page shown when the address names an organization the reader does not belong to, or one that does not exist.',
  },
  organizationNotFoundAction: {
    id: 'navigation.organizationNotFoundAction',
    defaultMessage: 'Go to {organizationName}',
    description:
      "Button on the organization not found page, leading to one of the reader's own organizations. {organizationName} is that organization's name, such as Acme.",
  },
})

export default navigationMessages
