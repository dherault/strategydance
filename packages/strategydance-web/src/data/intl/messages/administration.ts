import { defineMessages } from 'react-intl'

// The pages that administer Strategy Dance itself, which only its own administrators reach. The
// sidebar's links to them, and their titles, are in `navigation`
const administrationMessages = defineMessages({
  usersLead: {
    id: 'administration.users.lead',
    defaultMessage: '{count, plural, one {# person has} other {# people have}} signed up to Strategy Dance.',
    description: 'Line under the title of the administration page that lists every account on the product. "Strategy Dance" is the product name and stays untranslated.',
  },
  usersLoadError: {
    id: 'administration.users.loadError',
    defaultMessage: 'The accounts could not be loaded. Check your connection and try again.',
    description: 'Error shown in place of the table of every account when it could not be read.',
  },
  usersColumnName: {
    id: 'administration.users.column.name',
    defaultMessage: 'Name',
    description: 'Column header, in the table of every account, above each person\'s picture and name.',
  },
  usersColumnEmail: {
    id: 'administration.users.column.email',
    defaultMessage: 'Email',
    description: 'Column header, in the table of every account, above each person\'s email address.',
  },
  usersColumnOrganizations: {
    id: 'administration.users.column.organizations',
    defaultMessage: 'Organizations',
    description: 'Column header, in the table of every account, above the organizations each person belongs to.',
  },
  usersColumnSignIn: {
    id: 'administration.users.column.signIn',
    defaultMessage: 'Sign-in',
    description: 'Column header, in the table of every account, above the ways each person can sign in, such as a password or Google.',
  },
  usersColumnJoined: {
    id: 'administration.users.column.joined',
    defaultMessage: 'Joined',
    description: 'Column header, in the table of every account, above the date each person signed up.',
  },
  administrator: {
    id: 'administration.users.administrator',
    defaultMessage: 'Administrator',
    description: 'Small badge beside the name of somebody who administers the whole product, in the table of every account.',
  },
  copyEmail: {
    id: 'administration.users.copyEmail',
    defaultMessage: 'Copy the email address of {name}',
    description: 'Tooltip and accessible label of the button, beside an email address in the table of every account, that copies that address. {name} is the person\'s name, or their address when they gave none.',
  },
  emailCopied: {
    id: 'administration.users.emailCopied',
    defaultMessage: 'Email address copied',
    description: 'What that copy button says for a moment after it copied the address.',
  },
  noOrganization: {
    id: 'administration.users.noOrganization',
    defaultMessage: 'None',
    description: 'Shown in the "Organizations" column of the table of every account, for somebody who belongs to no organization.',
  },
  providerPassword: {
    id: 'administration.users.provider.password',
    defaultMessage: 'Password',
    description: 'Badge, in the "Sign-in" column of the table of every account, for somebody who can sign in with an email and a password.',
  },
  providerGoogle: {
    id: 'administration.users.provider.google',
    defaultMessage: 'Google',
    description: 'Badge, in the "Sign-in" column of the table of every account, for somebody who can sign in with their Google account. A brand name, so it stays untranslated.',
  },
  organizationsLead: {
    id: 'administration.organizations.lead',
    defaultMessage: '{count, plural, one {# organization has} other {# organizations have}} been created on Strategy Dance.',
    description: 'Line under the title of the administration page that lists every organization on the product. "Strategy Dance" is the product name and stays untranslated.',
  },
  organizationsLoadError: {
    id: 'administration.organizations.loadError',
    defaultMessage: 'The organizations could not be loaded. Check your connection and try again.',
    description: 'Error shown in place of the table of every organization when it could not be read.',
  },
  organizationsEmpty: {
    id: 'administration.organizations.empty',
    defaultMessage: 'Nobody has created an organization yet.',
    description: 'The one row of the table of every organization when there are none.',
  },
  organizationsColumnName: {
    id: 'administration.organizations.column.name',
    defaultMessage: 'Name',
    description: 'Column header, in the table of every organization, above each organization\'s logo and name.',
  },
  organizationsColumnMembers: {
    id: 'administration.organizations.column.members',
    defaultMessage: 'Members',
    description: 'Column header, in the table of every organization, above how many people belong to each.',
  },
  organizationsColumnProfile: {
    id: 'administration.organizations.column.profile',
    defaultMessage: 'Profile',
    description: 'Column header, in the table of every organization, above whether each one\'s profile is public or private.',
  },
  organizationsColumnAspects: {
    id: 'administration.organizations.column.aspects',
    defaultMessage: 'Aspects explored',
    description: 'Column header, in the table of every organization, above how many of the aspects of a company, such as strategy or finances, each has explored.',
  },
  organizationsColumnCreated: {
    id: 'administration.organizations.column.created',
    defaultMessage: 'Created',
    description: 'Column header, in the table of every organization, above the date each was created.',
  },
  organizationPublic: {
    id: 'administration.organizations.public',
    defaultMessage: 'Public',
    description: 'Badge, in the "Profile" column of the table of every organization, for one whose profile anybody can see.',
  },
  organizationPrivate: {
    id: 'administration.organizations.private',
    defaultMessage: 'Private',
    description: 'Badge, in the "Profile" column of the table of every organization, for one whose profile only its members can see.',
  },
  organizationAspects: {
    id: 'administration.organizations.aspects',
    defaultMessage: '{explored} of {total}',
    description: 'How many aspects of a company an organization has explored, out of all of them, in the table of every organization. For example "3 of 9".',
  },
})

export default administrationMessages
