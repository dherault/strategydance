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
  profilePreview: {
    id: 'account.profilePreview',
    defaultMessage: 'Profile preview',
    description: 'Accessible name of the panel on the profile tab that shows the reader\'s profile as others see it, read by screen readers.',
  },
  previewNameEmpty: {
    id: 'account.previewNameEmpty',
    defaultMessage: 'Your name',
    description: 'Shown greyed in the profile preview in place of the reader\'s name while the name field is empty.',
  },
  previewBioEmpty: {
    id: 'account.previewBioEmpty',
    defaultMessage: 'Add a short bio so your team and agents know what you focus on.',
    description: 'Shown greyed in the profile preview in place of the reader\'s bio while the bio field is empty.',
  },
  pictureLabel: {
    id: 'account.pictureLabel',
    defaultMessage: 'Profile picture',
    description: 'Label above the buttons that upload, change or remove the reader\'s profile picture.',
  },
  uploadPicture: {
    id: 'account.uploadPicture',
    defaultMessage: 'Upload photo',
    description: 'Button that picks a profile picture when the reader has none.',
  },
  changePicture: {
    id: 'account.changePicture',
    defaultMessage: 'Change photo',
    description: 'Button that picks another profile picture in place of the one the reader has.',
  },
  removePicture: {
    id: 'account.removePicture',
    defaultMessage: 'Remove',
    description: 'Button that takes the reader\'s profile picture away, leaving their initials.',
  },
  pictureHint: {
    id: 'account.pictureHint',
    defaultMessage: 'Square image, at least 256×256px, up to {megabytes} MB.',
    description: 'Advice under the profile picture buttons on what picture to choose, such as "Square image, at least 256×256px, up to 2 MB."',
  },
  pictureTypeError: {
    id: 'account.pictureTypeError',
    defaultMessage: 'Choose a PNG, JPEG, GIF or WebP picture.',
    description: 'Error shown when the reader picks a file that is not a supported image as their profile picture.',
  },
  pictureSizeError: {
    id: 'account.pictureSizeError',
    defaultMessage: 'Choose a picture of {megabytes} MB or less.',
    description: 'Error shown when the reader picks a profile picture that is too large, such as "Choose a picture of 2 MB or less."',
  },
  nameLabel: {
    id: 'account.nameLabel',
    defaultMessage: 'Name',
    description: 'Label of the field holding the reader\'s full name on the profile tab.',
  },
  namePlaceholder: {
    id: 'account.namePlaceholder',
    defaultMessage: 'Your full name',
    description: 'Placeholder in the empty name field on the profile tab.',
  },
  nameRequired: {
    id: 'account.nameRequired',
    defaultMessage: 'Name is required',
    description: 'Error under the name field on the profile tab when the reader has emptied it.',
  },
  bioLabel: {
    id: 'account.bioLabel',
    defaultMessage: 'Bio',
    description: 'Label of the field holding a few sentences about the reader on the profile tab.',
  },
  bioPlaceholder: {
    id: 'account.bioPlaceholder',
    defaultMessage: 'What you work on and how you like to work.',
    description: 'Placeholder in the empty bio field on the profile tab.',
  },
  bioHint: {
    id: 'account.bioHint',
    defaultMessage: 'Shown on your profile and to agents.',
    description: 'Hint under the bio field on the profile tab, saying who reads it. Agents are the product\'s AI assistants.',
  },
  bioCount: {
    id: 'account.bioCount',
    defaultMessage: '{count, number}/{max, number}',
    description: 'Counter under the bio field, how many characters were typed out of how many are allowed, such as "42/200".',
  },
  cancel: {
    id: 'account.cancel',
    defaultMessage: 'Cancel',
    description: 'Button at the bottom of the profile tab that throws away the changes not saved yet.',
  },
  save: {
    id: 'account.save',
    defaultMessage: 'Save changes',
    description: 'Button at the bottom of the profile tab that saves the name, picture and bio.',
  },
  saved: {
    id: 'account.saved',
    defaultMessage: 'Profile saved',
    description: 'Notification shown once the reader\'s profile has been saved.',
  },
  saveError: {
    id: 'account.saveError',
    defaultMessage: 'Your profile could not be saved. Try again.',
    description: 'Notification shown when saving the reader\'s profile failed.',
  },
})

export default accountMessages
