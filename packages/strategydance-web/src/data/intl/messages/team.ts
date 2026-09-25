import { defineMessages } from 'react-intl'

// The team page: the organization's members, what they do, and what they may do
const teamMessages = defineMessages({
  lead: {
    id: 'team.lead',
    defaultMessage: '{memberCount, plural, one {# member} other {# members}} in {organizationName}.',
    description: 'Introduction under the title of the team page, counting the people in the organization, such as "5 members in Acme."',
  },
  noOrganization: {
    id: 'team.noOrganization',
    defaultMessage: 'Create an organization from the menu at the top of the sidebar, then invite your team here.',
    description: 'Notice on the team page when the reader belongs to no organization yet.',
  },
  columnName: {
    id: 'team.columnName',
    defaultMessage: 'Name',
    description: 'Heading of the team table column listing each member\'s name.',
  },
  columnEmail: {
    id: 'team.columnEmail',
    defaultMessage: 'Email',
    description: 'Heading of the team table column listing each member\'s email address.',
  },
  columnJobTitle: {
    id: 'team.columnJobTitle',
    defaultMessage: 'Role',
    description: 'Heading of the team table column listing what each member does in the company, such as "Product designer". A job title, not a permission level.',
  },
  columnAccess: {
    id: 'team.columnAccess',
    defaultMessage: 'Access',
    description: 'Heading of the team table column listing what each member may do in the app: administrator or member.',
  },
  columnActions: {
    id: 'team.columnActions',
    defaultMessage: 'Actions',
    description: 'Accessible heading of the team table column holding the buttons that act on a member. Not shown on screen.',
  },
  you: {
    id: 'team.you',
    defaultMessage: '(you)',
    description: 'Marker beside the reader\'s own name in the team table.',
  },
  noJobTitle: {
    id: 'team.noJobTitle',
    defaultMessage: 'No role',
    description: 'Placeholder in the team table for a member who has not said what they do in the company.',
  },
  editOwnJobTitle: {
    id: 'team.editOwnJobTitle',
    defaultMessage: 'Edit your role',
    description: 'Accessible label of the pencil button beside the reader\'s own job title, and title of the dialog it opens.',
  },
  editJobTitleFor: {
    id: 'team.editJobTitleFor',
    defaultMessage: 'Edit role for {name}',
    description: 'Accessible label of the pencil button beside another member\'s job title.',
  },
  administrator: {
    id: 'team.administrator',
    defaultMessage: 'Administrator',
    description: 'Access level of a member who can invite people, change access and ban members.',
  },
  member: {
    id: 'team.member',
    defaultMessage: 'Member',
    description: 'Access level of a regular member of the organization.',
  },
  accessFor: {
    id: 'team.accessFor',
    defaultMessage: 'Access for {name}',
    description: 'Accessible label of the dropdown that changes a member\'s access level.',
  },
  onlyAdministrator: {
    id: 'team.onlyAdministrator',
    defaultMessage: 'An organization keeps at least one administrator. Make somebody else an administrator first.',
    description: 'Tooltip on the reader\'s own access dropdown when they are the only administrator and so cannot become a regular member.',
  },
  nowAdministratorSelf: {
    id: 'team.nowAdministratorSelf',
    defaultMessage: 'You are now an administrator',
    description: 'Confirmation shown after the reader gave themselves administrator access.',
  },
  nowMemberSelf: {
    id: 'team.nowMemberSelf',
    defaultMessage: 'You are now a member',
    description: 'Confirmation shown after the reader gave up administrator access.',
  },
  nowAdministrator: {
    id: 'team.nowAdministrator',
    defaultMessage: '{name} is now an administrator',
    description: 'Confirmation shown after the reader gave another member administrator access.',
  },
  nowMember: {
    id: 'team.nowMember',
    defaultMessage: '{name} is now a member',
    description: 'Confirmation shown after the reader took administrator access away from another member.',
  },
  accessError: {
    id: 'team.accessError',
    defaultMessage: 'The access could not be changed. Try again.',
    description: 'Error shown when changing a member\'s access level failed.',
  },
  ban: {
    id: 'team.ban',
    defaultMessage: 'Ban',
    description: 'Button in the team table that removes a member from the organization.',
  },
  banName: {
    id: 'team.banName',
    defaultMessage: 'Ban {name}',
    description: 'Accessible label of the ban button in a member\'s row, and title of the dialog confirming it.',
  },
  banDescription: {
    id: 'team.banDescription',
    defaultMessage: '{name} loses access to {organizationName} right away. You can invite them again later.',
    description: 'Explanation in the dialog confirming that a member is removed from the organization.',
  },
  banSubmit: {
    id: 'team.banSubmit',
    defaultMessage: 'Ban member',
    description: 'Button that removes the member, in the dialog confirming it. It asks to be clicked a second time.',
  },
  banConfirm: {
    id: 'team.banConfirm',
    defaultMessage: 'Confirm?',
    description: 'What the ban button says after its first click, asking to be clicked again to go ahead.',
  },
  banned: {
    id: 'team.banned',
    defaultMessage: '{name} was banned',
    description: 'Confirmation shown after a member was removed from the organization.',
  },
  banError: {
    id: 'team.banError',
    defaultMessage: '{name} could not be banned. Try again.',
    description: 'Error shown when removing a member from the organization failed.',
  },
  cancel: {
    id: 'team.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that closes a dialog on the team page without doing anything.',
  },
  close: {
    id: 'team.close',
    defaultMessage: 'Close',
    description: 'Accessible label of the button in the corner of a dialog on the team page that closes it.',
  },
  editJobTitle: {
    id: 'team.editJobTitle',
    defaultMessage: 'Edit role',
    description: 'Title of the dialog where the reader writes what another member does in the company.',
  },
  editOwnJobTitleDescription: {
    id: 'team.editOwnJobTitleDescription',
    defaultMessage: 'What you do at {organizationName}.',
    description: 'Explanation under the title of the dialog where the reader writes their own job title.',
  },
  editJobTitleDescription: {
    id: 'team.editJobTitleDescription',
    defaultMessage: 'What {name} does at {organizationName}.',
    description: 'Explanation under the title of the dialog where the reader writes another member\'s job title.',
  },
  jobTitleLabel: {
    id: 'team.jobTitleLabel',
    defaultMessage: 'Role',
    description: 'Label of the field holding a job title, such as "Product designer".',
  },
  jobTitlePlaceholder: {
    id: 'team.jobTitlePlaceholder',
    defaultMessage: 'Product designer',
    description: 'Example job title shown in the empty job title field.',
  },
  save: {
    id: 'team.save',
    defaultMessage: 'Save',
    description: 'Button that saves a job title.',
  },
  jobTitleUpdated: {
    id: 'team.jobTitleUpdated',
    defaultMessage: 'Role updated',
    description: 'Confirmation shown after a job title was saved.',
  },
  jobTitleError: {
    id: 'team.jobTitleError',
    defaultMessage: 'The role could not be saved. Try again.',
    description: 'Error shown in the job title dialog when saving failed.',
  },
})

export default teamMessages
