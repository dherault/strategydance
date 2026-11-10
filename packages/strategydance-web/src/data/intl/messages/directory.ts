import { defineMessages } from 'react-intl'

/*
  The directories: the places a startup can be listed in, which the team works through on their
  page, under the Marketing aspect, and in a section of the Marketing aspect's page, each with a
  status, To do, Submitted, Listed or Dismissed, and the team's notes. A directory's name and its
  description are written from its own site, in English, and are not translated
*/
const directoryMessages = defineMessages({
  title: {
    id: 'directory.title',
    defaultMessage: 'Directories',
    description:
      'Title of the Directories page, and of the section of the Marketing page that leads to it: the websites and communities a startup can be listed in, such as product directories and launch sites.',
  },
  lead: {
    id: 'directory.lead',
    defaultMessage:
      '{count, plural, one {# place} other {# places}} to list your product. {listed, number} listed, {submitted, number} submitted.',
    description:
      'Line under the title of the Directories page. {count} is how many directories there are, {listed} how many list the company’s product already, and {submitted} how many it was sent to and waits on.',
  },
  sectionDescription: {
    id: 'directory.sectionDescription',
    defaultMessage: 'Places to list your product so the people looking for it find it.',
    description:
      'Line under the Directories section of the Marketing page, which shows the next few directories to send the company’s product to.',
  },
  viewAll: {
    id: 'directory.viewAll',
    defaultMessage: 'View all directories',
    description:
      'Button of the Directories section of the Marketing page, opening the page that lists every directory.',
  },
  progressListed: {
    id: 'directory.progressListed',
    defaultMessage: '<strong>{count, number}</strong> listed',
    description:
      'In the Directories section of the Marketing page: how many directories list the company’s product. The number between the tags is shown bold.',
  },
  progressSubmitted: {
    id: 'directory.progressSubmitted',
    defaultMessage: '<strong>{count, number}</strong> submitted',
    description:
      'In the Directories section of the Marketing page: how many directories the company sent its product to and waits on. The number between the tags is shown bold.',
  },
  progressToDo: {
    id: 'directory.progressToDo',
    defaultMessage: '<strong>{count, number}</strong> to do',
    description:
      'In the Directories section of the Marketing page: how many directories the company has not acted on yet. The number between the tags is shown bold.',
  },
  allDoneTitle: {
    id: 'directory.allDoneTitle',
    defaultMessage: 'Every directory has a status',
    description:
      'Title in the Directories section of the Marketing page once the company has submitted to, been listed in or dismissed every directory, so none is left to suggest.',
  },
  allDoneText: {
    id: 'directory.allDoneText',
    defaultMessage: 'Check the submitted ones to see which are now listed.',
    description: 'Line under "Every directory has a status", in the Directories section of the Marketing page.',
  },
  loadError: {
    id: 'directory.loadError',
    defaultMessage: 'The directories could not be loaded.',
    description: 'Shown in place of the directories when they could not be read, with a button to try again.',
  },
  retry: {
    id: 'directory.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads the directories again after they could not be loaded.',
  },
  tabsLabel: {
    id: 'directory.tabsLabel',
    defaultMessage: 'Status',
    description:
      'What a screen reader calls the row of tabs at the top of the Directories page, one per status: To do, Submitted, Listed, Dismissed and All.',
  },
  allTab: {
    id: 'directory.allTab',
    defaultMessage: 'All',
    description: 'Tab of the Directories page showing every directory, whatever its status. A count follows it.',
  },
  statusToDo: {
    id: 'directory.statusToDo',
    defaultMessage: 'To do',
    description:
      'Status of a directory the company has not acted on yet, as a tab of the Directories page, a badge and a choice of the status select.',
  },
  statusSubmitted: {
    id: 'directory.statusSubmitted',
    defaultMessage: 'Submitted',
    description:
      'Status of a directory the company sent its product to, whose listing is not live yet, as a tab, a badge and a choice of the status select.',
  },
  statusListed: {
    id: 'directory.statusListed',
    defaultMessage: 'Listed',
    description:
      'Status of a directory that lists the company’s product, live, as a tab, a badge and a choice of the status select.',
  },
  statusDismissed: {
    id: 'directory.statusDismissed',
    defaultMessage: 'Dismissed',
    description:
      'Status of a directory the company decided not to send its product to, as a tab, a badge and a choice of the status select.',
  },
  search: {
    id: 'directory.search',
    defaultMessage: 'Search',
    description: 'Placeholder of the search field of the Directories page.',
  },
  searchLabel: {
    id: 'directory.searchLabel',
    defaultMessage: 'Search directories',
    description:
      'What a screen reader calls the search field of the Directories page, which looks at names, descriptions, addresses and the team’s notes.',
  },
  pricingPlaceholder: {
    id: 'directory.pricingPlaceholder',
    defaultMessage: 'Any pricing',
    description:
      'Shown in the Directories page’s filter by pricing while it keeps every directory, whatever it charges.',
  },
  pricingFilterLabel: {
    id: 'directory.pricingFilterLabel',
    defaultMessage: 'Filter by pricing',
    description: 'What a screen reader calls the Directories page’s filter by what a directory charges.',
  },
  categoryPlaceholder: {
    id: 'directory.categoryPlaceholder',
    defaultMessage: 'Any category',
    description:
      'Shown in the Directories page’s filter by category while it keeps every directory, whatever kinds of product it lists.',
  },
  categoryFilterLabel: {
    id: 'directory.categoryFilterLabel',
    defaultMessage: 'Filter by category',
    description: 'What a screen reader calls the Directories page’s filter by the kinds of product a directory lists.',
  },
  typeFilterLabel: {
    id: 'directory.typeFilterLabel',
    defaultMessage: 'Filter by type',
    description: 'What a screen reader calls the Directories page’s filter by type: websites or Reddit communities.',
  },
  allTypes: {
    id: 'directory.allTypes',
    defaultMessage: 'All types',
    description: 'Choice of the Directories page’s filter by type that keeps websites and Reddit communities alike.',
  },
  websites: {
    id: 'directory.websites',
    defaultMessage: 'Websites',
    description: 'Choice of the Directories page’s filter by type that keeps the directories that are websites.',
  },
  redditCommunities: {
    id: 'directory.redditCommunities',
    defaultMessage: 'Reddit',
    description: 'Choice of the Directories page’s filter by type that keeps the Reddit communities.',
  },
  filterSearch: {
    id: 'directory.filterSearch',
    defaultMessage: 'Search',
    description: 'Placeholder of the search field inside the Directories page’s filters by pricing and by category.',
  },
  filterNoMatch: {
    id: 'directory.filterNoMatch',
    defaultMessage: 'No match',
    description: 'Shown inside a filter of the Directories page when its search matches none of its choices.',
  },
  filterClear: {
    id: 'directory.filterClear',
    defaultMessage: 'Clear',
    description: 'Button at the foot of a filter of the Directories page that unticks every choice.',
  },
  filterClose: {
    id: 'directory.filterClose',
    defaultMessage: 'Close',
    description: 'Button at the foot of a filter of the Directories page that closes its list of choices.',
  },
  filterMore: {
    id: 'directory.filterMore',
    defaultMessage: '+{count, number} more',
    description:
      'Chip of a filter of the Directories page counting the choices ticked that do not fit. {count} is how many.',
  },
  clearFilters: {
    id: 'directory.clearFilters',
    defaultMessage: 'Clear filters',
    description: 'Button of the Directories page that empties its search and its filters.',
  },
  count: {
    id: 'directory.count',
    defaultMessage: '{count, plural, one {# directory} other {# directories}}',
    description: 'How many directories the Directories page shows under its tab, search and filters.',
  },
  columnDirectory: {
    id: 'directory.columnDirectory',
    defaultMessage: 'Directory',
    description: 'Heading of the column of the Directories page’s table naming each directory, with its description.',
  },
  columnPricing: {
    id: 'directory.columnPricing',
    defaultMessage: 'Pricing',
    description: 'Heading of the column of the Directories page’s table saying what each directory charges.',
  },
  columnCategories: {
    id: 'directory.columnCategories',
    defaultMessage: 'Categories',
    description:
      'Heading of the column of the Directories page’s table saying the kinds of product each directory lists.',
  },
  columnStatus: {
    id: 'directory.columnStatus',
    defaultMessage: 'Status',
    description:
      'Heading of the column of the Directories page’s table giving where the company stands with each directory.',
  },
  columnSubmission: {
    id: 'directory.columnSubmission',
    defaultMessage: 'Submission page',
    description:
      'Heading, read by screen readers alone, of the column of the Directories page’s table holding the link to each directory’s submission page.',
  },
  hasNotes: {
    id: 'directory.hasNotes',
    defaultMessage: 'Has notes',
    description: 'Tooltip of the icon beside a directory’s name when the team wrote notes on it.',
  },
  reddit: {
    id: 'directory.reddit',
    defaultMessage: 'Reddit',
    description: 'Badge beside a directory that is a Reddit community rather than a website.',
  },
  unreachable: {
    id: 'directory.unreachable',
    defaultMessage: 'Unreachable',
    description:
      'Badge beside a directory whose site the daily check could not reach lately, so it may be down or gone.',
  },
  unreachableSince: {
    id: 'directory.unreachableSince',
    defaultMessage: 'Unreachable since {date}',
    description:
      'Badge in a directory’s dialog when the daily check could not reach its site lately. {date} is the day it first failed.',
  },
  openSubmissionPage: {
    id: 'directory.openSubmissionPage',
    defaultMessage: 'Open submission page',
    description:
      'Tooltip of the link to a directory’s submission page, which opens in a new tab, and button of its dialog.',
  },
  openSubmissionPageOf: {
    id: 'directory.openSubmissionPageOf',
    defaultMessage: 'Open the submission page of {name}',
    description:
      'What a screen reader calls the link to a directory’s submission page in a row of the table. {name} is the directory’s.',
  },
  visitSite: {
    id: 'directory.visitSite',
    defaultMessage: 'Visit site',
    description: 'Button of a directory’s dialog opening its website in a new tab.',
  },
  visitCommunity: {
    id: 'directory.visitCommunity',
    defaultMessage: 'Visit community',
    description: 'Button of a directory’s dialog opening its Reddit community in a new tab.',
  },
  toDoEmptyTitle: {
    id: 'directory.toDoEmptyTitle',
    defaultMessage: 'Nothing left to do',
    description: 'Title of the To do tab of the Directories page once every directory has a status.',
  },
  submittedEmptyTitle: {
    id: 'directory.submittedEmptyTitle',
    defaultMessage: 'No submitted directories yet',
    description: 'Title of the Submitted tab of the Directories page while the company has sent its product to none.',
  },
  listedEmptyTitle: {
    id: 'directory.listedEmptyTitle',
    defaultMessage: 'No listed directories yet',
    description: 'Title of the Listed tab of the Directories page while no directory lists the company’s product.',
  },
  dismissedEmptyTitle: {
    id: 'directory.dismissedEmptyTitle',
    defaultMessage: 'No dismissed directories yet',
    description: 'Title of the Dismissed tab of the Directories page while the company has dismissed none.',
  },
  emptyText: {
    id: 'directory.emptyText',
    defaultMessage: 'Open a directory to set its status.',
    description: 'Line under the title of a tab of the Directories page that holds no directory.',
  },
  noMatchTitle: {
    id: 'directory.noMatchTitle',
    defaultMessage: 'No directories match these filters',
    description: 'Title of the Directories page once its search and filters leave no directory.',
  },
  noMatchText: {
    id: 'directory.noMatchText',
    defaultMessage: 'Search looks at names, descriptions, addresses and your notes.',
    description: 'Line under "No directories match these filters", saying what the search looks at.',
  },
  noDescription: {
    id: 'directory.noDescription',
    defaultMessage: 'No description yet.',
    description: 'Shown in a directory’s dialog when nobody has described the directory yet.',
  },
  notes: {
    id: 'directory.notes',
    defaultMessage: 'Notes',
    description: 'Heading of the team’s notes on a directory, in its dialog, saved as they are typed.',
  },
  notesLabel: {
    id: 'directory.notesLabel',
    defaultMessage: 'Notes for {name}',
    description: 'What a screen reader calls the editor of the team’s notes on a directory. {name} is the directory’s.',
  },
  notesPlaceholder: {
    id: 'directory.notesPlaceholder',
    defaultMessage: 'Logins, what you sent, replies and follow-ups',
    description: 'Placeholder of the editor of the team’s notes on a directory, saying what they are for.',
  },
  notesLoadError: {
    id: 'directory.notesLoadError',
    defaultMessage: 'The notes could not be loaded.',
    description:
      'Shown in place of the team’s notes on a directory when they could not be read, with a button to try again.',
  },
  notesSaveError: {
    id: 'directory.notesSaveError',
    defaultMessage: 'The notes could not be saved. Try again.',
    description: 'Notification when the team’s notes on a directory did not save.',
  },
  notesTooLong: {
    id: 'directory.notesTooLong',
    defaultMessage: 'Notes are too long to save. Shorten them to keep what you type.',
    description: 'Shown under the notes on a directory once they pass the longest notes that can be saved.',
  },
  turnInto: {
    id: 'directory.turnInto',
    defaultMessage: 'Turn into',
    description:
      'In the menu of the notes’ editor, the heading over the kinds of block a paragraph can become, such as a heading or a list.',
  },
  loadingEditor: {
    id: 'directory.loadingEditor',
    defaultMessage: 'Loading the editor…',
    description: 'Shown in place of the notes’ editor while it loads.',
  },
  editorError: {
    id: 'directory.editorError',
    defaultMessage: 'The editor could not load. Reload the page to try again.',
    description: 'Shown in place of the notes’ editor when it could not load.',
  },
  status: {
    id: 'directory.status',
    defaultMessage: 'Status',
    description: 'Label of the select setting where the company stands with a directory, in its dialog.',
  },
  statusHint: {
    id: 'directory.statusHint',
    defaultMessage: 'Set it to submitted once you send your product, then listed when it is live.',
    description: 'Line under the status select of a directory still to do, saying how to use it.',
  },
  statusChangedJustNow: {
    id: 'directory.statusChangedJustNow',
    defaultMessage: '{status} just now',
    description:
      'Line under the status select of a directory, when its status changed under a minute ago. {status} is it, such as "Submitted".',
  },
  statusChangedAgo: {
    id: 'directory.statusChangedAgo',
    defaultMessage: '{status} {time}',
    description:
      'Line under the status select of a directory, saying when its status changed. {status} is it, such as "Submitted", {time} how long ago, such as "3 days ago".',
  },
  statusChangedOn: {
    id: 'directory.statusChangedOn',
    defaultMessage: '{status} on {date}',
    description:
      'Line under the status select of a directory whose status changed over a week ago. {status} is it, such as "Submitted", {date} the day.',
  },
  pricing: {
    id: 'directory.pricing',
    defaultMessage: 'Pricing',
    description: 'Label, in a directory’s dialog, of what it charges.',
  },
  categories: {
    id: 'directory.categories',
    defaultMessage: 'Categories',
    description: 'Label, in a directory’s dialog, of the kinds of product it lists.',
  },
  type: {
    id: 'directory.type',
    defaultMessage: 'Type',
    description: 'Label, in a directory’s dialog, of whether it is a website or a Reddit community.',
  },
  website: {
    id: 'directory.website',
    defaultMessage: 'Website',
    description: 'Type of a directory that is a website, in its dialog.',
  },
  redditCommunity: {
    id: 'directory.redditCommunity',
    defaultMessage: 'Reddit community',
    description: 'Type of a directory that is a Reddit community, in its dialog.',
  },
  done: {
    id: 'directory.done',
    defaultMessage: 'Done',
    description: 'Button closing a directory’s dialog, whose status and notes save as they change.',
  },
  close: {
    id: 'directory.close',
    defaultMessage: 'Close',
    description: 'What a screen reader calls the cross closing a directory’s dialog.',
  },
  markedStatus: {
    id: 'directory.markedStatus',
    defaultMessage:
      '{name} marked {status, select, SUBMITTED {submitted} LISTED {listed} DISMISSED {dismissed} other {}}',
    description:
      'Notification once a directory’s status is saved. {name} is the directory’s, {status} the status it was given.',
  },
  movedToDo: {
    id: 'directory.movedToDo',
    defaultMessage: '{name} moved back to to do',
    description: 'Notification once a directory’s status is taken back to To do. {name} is the directory’s.',
  },
  statusSaveError: {
    id: 'directory.statusSaveError',
    defaultMessage: 'The status could not be saved. Try again.',
    description: 'Notification when a directory’s status did not save.',
  },
  pricingFree: {
    id: 'directory.pricingFree',
    defaultMessage: 'Free',
    description: 'What a directory charges: nothing.',
  },
  pricingFreeWithBadge: {
    id: 'directory.pricingFreeWithBadge',
    defaultMessage: 'Free with badge',
    description: 'What a directory charges: nothing, as long as the product shows the directory’s badge on its site.',
  },
  pricingFreeWithGate: {
    id: 'directory.pricingFreeWithGate',
    defaultMessage: 'Free with requirements',
    description: 'What a directory charges: nothing, for a product that meets its requirements, such as traction.',
  },
  pricingFreeWithLongQueue: {
    id: 'directory.pricingFreeWithLongQueue',
    defaultMessage: 'Free, long queue',
    description: 'What a directory charges: nothing, after a long wait, unless one pays to go faster.',
  },
  pricingFreeWithCuration: {
    id: 'directory.pricingFreeWithCuration',
    defaultMessage: 'Free, curated',
    description: 'What a directory charges: nothing, for a product its editors choose to list.',
  },
  pricingFreeWithPaidPromotion: {
    id: 'directory.pricingFreeWithPaidPromotion',
    defaultMessage: 'Free, paid promotion',
    description: 'What a directory charges: nothing to be listed, with paid placements to stand out.',
  },
  pricingFreeWithPaidSkip: {
    id: 'directory.pricingFreeWithPaidSkip',
    defaultMessage: 'Free, paid skip',
    description: 'What a directory charges: nothing, or a fee to skip its waiting list.',
  },
  pricingFreeWithEngagement: {
    id: 'directory.pricingFreeWithEngagement',
    defaultMessage: 'Free, needs engagement',
    description: 'What a directory charges: nothing, for a member who takes part in its community first.',
  },
  pricingFreeForLimitedTime: {
    id: 'directory.pricingFreeForLimitedTime',
    defaultMessage: 'Free for a limited time',
    description: 'What a directory charges: nothing for now, until its free offer ends.',
  },
  pricingPaid: {
    id: 'directory.pricingPaid',
    defaultMessage: 'Paid',
    description: 'What a directory charges: a fee to be listed.',
  },
  pricingUnknown: {
    id: 'directory.pricingUnknown',
    defaultMessage: 'Pricing unknown',
    description: 'What a directory charges: not known yet.',
  },
  categoryAnyStartup: {
    id: 'directory.categoryAnyStartup',
    defaultMessage: 'Any startup',
    description: 'Kind of product a directory lists: any startup at all.',
  },
  categoryAiTools: {
    id: 'directory.categoryAiTools',
    defaultMessage: 'AI tools',
    description: 'Kind of product a directory lists: tools built on AI.',
  },
  categoryAiAgents: {
    id: 'directory.categoryAiAgents',
    defaultMessage: 'AI agents',
    description: 'Kind of product a directory lists: AI agents, which act on their own.',
  },
  categoryMcpServers: {
    id: 'directory.categoryMcpServers',
    defaultMessage: 'MCP servers',
    description:
      'Kind of product a directory lists: MCP servers, which give AI assistants tools. MCP is a name, kept as is.',
  },
  categorySaas: {
    id: 'directory.categorySaas',
    defaultMessage: 'SaaS',
    description: 'Kind of product a directory lists: software sold as a service, online.',
  },
  categoryDeveloperTools: {
    id: 'directory.categoryDeveloperTools',
    defaultMessage: 'Developer tools',
    description: 'Kind of product a directory lists: tools for software developers.',
  },
  categoryOpenSource: {
    id: 'directory.categoryOpenSource',
    defaultMessage: 'Open source',
    description: 'Kind of product a directory lists: open source software.',
  },
  categoryNoCode: {
    id: 'directory.categoryNoCode',
    defaultMessage: 'No-code',
    description: 'Kind of product a directory lists: tools that build software without writing code.',
  },
  categoryMobileApps: {
    id: 'directory.categoryMobileApps',
    defaultMessage: 'Mobile apps',
    description: 'Kind of product a directory lists: apps for phones.',
  },
  categoryDesign: {
    id: 'directory.categoryDesign',
    defaultMessage: 'Design',
    description: 'Kind of product a directory lists: tools and resources for designers.',
  },
  categoryMarketing: {
    id: 'directory.categoryMarketing',
    defaultMessage: 'Marketing',
    description: 'Kind of product a directory lists: tools for marketing.',
  },
  categoryRegional: {
    id: 'directory.categoryRegional',
    defaultMessage: 'Regional',
    description: 'Kind of directory: one listing the startups of a single region or country.',
  },
})

export default directoryMessages
