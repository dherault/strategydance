import { defineMessages } from 'react-intl'

/*
  Ids are explicit and dotted, `<messageType>.<path>`, and must be unique across every message file:
  the translation lock is indexed by id alone, so a message that moves between files keeps its
  translations. `collectSourceMessages` throws on a duplicate

  Never write an em dash in a defaultMessage or a description. It reads as machine-written, and
  every translated locale inherits whatever the English carries
*/
const globalMessages = defineMessages({
  language: {
    id: 'global.language',
    defaultMessage: 'Language',
    description: 'Accessible label of the control that switches the interface language.',
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
  showPassword: {
    id: 'global.showPassword',
    defaultMessage: 'Show password',
    description: 'Accessible label of the eye button at the end of a password field, which reveals the password typed in it.',
  },
  hidePassword: {
    id: 'global.hidePassword',
    defaultMessage: 'Hide password',
    description: 'Accessible label of the eye button at the end of a password field, which hides the password typed in it again.',
  },
  organizationsLoadError: {
    id: 'global.organizationsLoadError',
    defaultMessage: 'Your organizations could not be loaded. Check your connection and try again.',
    description: 'Error on a full-page screen when the list of organizations the reader belongs to could not be read.',
  },
  retry: {
    id: 'global.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads something again after it failed to load.',
  },
  logOut: {
    id: 'global.logOut',
    defaultMessage: 'Log out',
    description: 'Button in the corner of a full-page screen, like the onboarding or an invitation, that signs the reader out.',
  },
  notFoundTitle: {
    id: 'global.notFoundTitle',
    defaultMessage: 'Page not found',
    description: 'Title of the full-page screen shown when the address in the browser leads to no page of the app.',
  },
  notFoundLead: {
    id: 'global.notFoundLead',
    defaultMessage: 'There is nothing at this address. The link may be broken, or the page may have moved.',
    description: 'Explanation under the title of the page-not-found screen.',
  },
  goHome: {
    id: 'global.goHome',
    defaultMessage: 'Go home',
    description: 'Button on the page-not-found screen that leads to the home page of the site.',
  },
})

export default globalMessages
