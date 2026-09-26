import { defineMessages } from 'react-intl'

/*
  Ids are explicit and dotted, `<messageType>.<path>`, and must be unique across every message file:
  the translation lock is indexed by id alone, so a message that moves between files keeps its
  translations. `collectSourceMessages` throws on a duplicate

  Never write an em dash in a defaultMessage or a description. It reads as machine-written, and
  every translated locale inherits whatever the English carries
*/
const globalMessages = defineMessages({
  welcome: {
    id: 'global.welcome',
    defaultMessage: 'Strategy Dance',
    description: 'Main heading on the home page. The product name, so it stays untranslated.',
  },
  tagline: {
    id: 'global.tagline',
    defaultMessage: 'An AI experiment.',
    description: 'One-line description of the product, shown under the heading on the home page.',
  },
  language: {
    id: 'global.language',
    defaultMessage: 'Language',
    description: 'Accessible label of the control that switches the interface language.',
  },
  signIn: {
    id: 'global.signIn',
    defaultMessage: 'Sign in',
    description: 'Button on the home page that leads to the sign-in page.',
  },
  loading: {
    id: 'global.loading',
    defaultMessage: 'Loading',
    description: 'Accessible label announced while the page waits for content.',
  },
  notifications: {
    id: 'global.notifications',
    defaultMessage: 'Notifications',
    description: 'Accessible label of the screen region where short confirmation messages pop up, like "Invitation sent".',
  },
  closeNotification: {
    id: 'global.closeNotification',
    defaultMessage: 'Close notification',
    description: 'Accessible label of the button that dismisses one of those short confirmation messages.',
  },
})

export default globalMessages
