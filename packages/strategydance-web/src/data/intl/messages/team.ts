import { defineMessages } from 'react-intl'

// The team page: the organization's members, what they do, and what they may do
const teamMessages = defineMessages({
  lead: {
    id: 'team.lead',
    defaultMessage: '{memberCount, plural, one {# member} other {# members}} in {organizationName}{invitationCount, plural, =0 {} one {, # pending invitation} other {, # pending invitations}}.',
    description: 'Introduction under the title of the team page, counting the people in the organization and the invitations nobody has answered yet, such as "5 members in Acme, 2 pending invitations."',
  },
  invite: {
    id: 'team.invite',
    defaultMessage: 'Invite',
    description: 'Button on the team page that opens the dialog for inviting people to the organization.',
  },
  invitationPending: {
    id: 'team.invitationPending',
    defaultMessage: 'Invitation pending',
    description: 'Badge in the team table on the row of somebody who was invited and has not joined yet.',
  },
  cancelInvitationFor: {
    id: 'team.cancelInvitationFor',
    defaultMessage: 'Cancel invitation for {email}',
    description: 'Accessible label of the button that withdraws a pending invitation.',
  },
  invitationCanceled: {
    id: 'team.invitationCanceled',
    defaultMessage: 'Invitation for {email} canceled',
    description: 'Confirmation shown after a pending invitation was withdrawn.',
  },
  cancelInvitationError: {
    id: 'team.cancelInvitationError',
    defaultMessage: 'The invitation for {email} could not be canceled. Try again.',
    description: 'Error shown when withdrawing a pending invitation failed.',
  },
  inviteTitle: {
    id: 'team.inviteTitle',
    defaultMessage: 'Invite members',
    description: 'Title of the dialog for inviting people to the organization by email.',
  },
  inviteDescription: {
    id: 'team.inviteDescription',
    defaultMessage: 'They will get an email to join {organizationName} as members.',
    description: 'Explanation under the title of the invite dialog.',
  },
  inviteEmailsLabel: {
    id: 'team.inviteEmailsLabel',
    defaultMessage: 'Emails',
    description: 'Label of the field where the reader types the email addresses to invite.',
  },
  inviteEmailsExample: {
    id: 'team.inviteEmailsExample',
    defaultMessage: 'jane@company.com, sam@company.com',
    description: 'First line of the example shown in the empty invite field. Keep the example addresses as they are.',
  },
  inviteEmailsOnePerLine: {
    id: 'team.inviteEmailsOnePerLine',
    defaultMessage: 'or one per line',
    description: 'Second line of the example shown in the empty invite field, under two example addresses separated by a comma.',
  },
  inviteEmailsHint: {
    id: 'team.inviteEmailsHint',
    defaultMessage: 'Separate emails with commas or new lines.',
    description: 'Hint under the invite field.',
  },
  emailListMore: {
    id: 'team.emailListMore',
    defaultMessage: '{count} more',
    description: 'Last item of a shortened list of email addresses, standing for the ones left out, as in "a@x.com, b@x.com and 3 more".',
  },
  invalidEmails: {
    id: 'team.invalidEmails',
    defaultMessage: '{count, plural, one {Invalid email: {emails}.} other {# invalid emails: {emails}.}}',
    description: 'Error under the invite field listing what is not an email address.',
  },
  alreadyMembers: {
    id: 'team.alreadyMembers',
    defaultMessage: '{count, plural, one {Already a member: {emails}.} other {Already members: {emails}.}}',
    description: 'Error under the invite field listing addresses that belong to members of the organization already.',
  },
  alreadyInvited: {
    id: 'team.alreadyInvited',
    defaultMessage: 'Already invited: {emails}.',
    description: 'Error under the invite field listing addresses that have a pending invitation already.',
  },
  tooManyInvitations: {
    id: 'team.tooManyInvitations',
    defaultMessage: 'At most {max} invitations at a time.',
    description: 'Error under the invite field when it holds more addresses than one request may carry.',
  },
  teamFull: {
    id: 'team.teamFull',
    defaultMessage: '{room, plural, =0 {This team is full: it holds at most {max} members and pending invitations.} one {This team has room for one more member or invitation, out of {max}.} other {This team has room for # more members or invitations, out of {max}.}}',
    description: 'Error under the invite field when the team cannot hold every address typed, saying how many more it can take.',
  },
  inviteTeamFullError: {
    id: 'team.inviteTeamFullError',
    defaultMessage: 'The team filled up in the meantime. Cancel some pending invitations to make room.',
    description: 'Error in the invite dialog when the team reached its size limit since the page last updated.',
  },
  invitationsReady: {
    id: 'team.invitationsReady',
    defaultMessage: '{count, plural, one {<b>#</b> invitation ready} other {<b>#</b> invitations ready}}',
    description: 'Summary at the bottom of the invite dialog counting the valid addresses typed so far. The number is shown in bold.',
  },
  noEmailsYet: {
    id: 'team.noEmailsYet',
    defaultMessage: 'No emails yet',
    description: 'Summary at the bottom of the invite dialog while no valid address has been typed.',
  },
  sendInvitations: {
    id: 'team.sendInvitations',
    defaultMessage: '{count, plural, =0 {Send invitation} one {Send invitation} other {Send # invitations}}',
    description: 'Button that sends the invitations typed in the invite dialog.',
  },
  invitationsSent: {
    id: 'team.invitationsSent',
    defaultMessage: '{count, plural, one {Invitation sent to {email}} other {# invitations sent}}',
    description: 'Confirmation shown after invitations were sent.',
  },
  invitationsFailed: {
    id: 'team.invitationsFailed',
    defaultMessage: 'Could not invite {emails}. Somebody may have invited them in the meantime.',
    description: 'Error shown when some of the invitations sent together could not be created.',
  },
  inviteConflictError: {
    id: 'team.inviteConflictError',
    defaultMessage: 'Some of these addresses joined or were invited in the meantime. Check the list and try again.',
    description: 'Error in the invite dialog when the server found addresses that belong to members or were invited since the page last updated.',
  },
  inviteRateLimitError: {
    id: 'team.inviteRateLimitError',
    defaultMessage: 'Too many invitations in a short time. Try again in a few minutes.',
    description: 'Error in the invite dialog when the reader sent too many invitations recently.',
  },
  inviteError: {
    id: 'team.inviteError',
    defaultMessage: 'The invitations could not be sent. Try again.',
    description: 'Error in the invite dialog when sending the invitations failed for another reason.',
  },
  noOrganization: {
    id: 'team.noOrganization',
    defaultMessage: 'Create an organization from the menu at the top of the sidebar, then invite your team here.',
    description: 'Notice on the team page when the reader belongs to no organization yet.',
  },
  loadError: {
    id: 'team.loadError',
    defaultMessage: 'The team could not be loaded. Check your connection and try again.',
    description: 'Error on the team page when reading the members and invitations failed.',
  },
  retry: {
    id: 'team.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads the team again after it failed to load.',
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
