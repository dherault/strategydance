import { defineMessages } from 'react-intl'

// The reader's account page: their profile, and how they sign in
const accountMessages = defineMessages({
  eyebrow: {
    id: 'account.eyebrow',
    defaultMessage: 'Personal',
    description: 'Small uppercase label above the title of the account page, saying the page is about the reader rather than their organization.',
  },
  lead: {
    id: 'account.lead',
    defaultMessage: 'Your personal profile and sign-in, shared across every organization you belong to.',
    description: 'Introduction under the title of the account page.',
  },
  tabsLabel: {
    id: 'account.tabsLabel',
    defaultMessage: 'Account sections',
    description: 'Accessible name of the row of tabs on the account page, read by screen readers.',
  },
  profileTab: {
    id: 'account.profileTab',
    defaultMessage: 'Profile',
    description: 'Tab of the account page where the reader edits their name, picture and bio.',
  },
  securityTab: {
    id: 'account.securityTab',
    defaultMessage: 'Security',
    description: 'Tab of the account page where the reader changes their password.',
  },
})

export default accountMessages
