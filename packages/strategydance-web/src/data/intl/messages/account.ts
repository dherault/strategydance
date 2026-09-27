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
  pictureDialogDescription: {
    id: 'account.pictureDialogDescription',
    defaultMessage: 'Appears next to your name, for your team and agents.',
    description: 'Description in the dialog for choosing the reader\'s profile picture. Agents are the product\'s AI assistants.',
  },
  choosePicture: {
    id: 'account.choosePicture',
    defaultMessage: 'Choose a profile picture',
    description: 'Accessible label of the area in the profile picture dialog that opens the file picker, or takes a file dragged onto it.',
  },
  pictureDropPrompt: {
    id: 'account.pictureDropPrompt',
    defaultMessage: '<strong>Choose a file</strong> or drag it here',
    description: 'Text inside the empty area of the profile picture dialog. The part in the strong tag is highlighted, since clicking the area opens the file picker.',
  },
  picturePreviewAlt: {
    id: 'account.picturePreviewAlt',
    defaultMessage: 'Profile picture preview',
    description: 'Alternative text of the chosen profile picture as the dialog previews it before it is applied.',
  },
  pictureSquare: {
    id: 'account.pictureSquare',
    defaultMessage: 'Square image',
    description: 'Hint under the picture in the profile picture dialog: it should be as wide as it is tall.',
  },
  pictureMinimumSize: {
    id: 'account.pictureMinimumSize',
    defaultMessage: 'At least {width}×{height}px',
    description: 'Hint under the picture in the profile picture dialog, its smallest recommended size in pixels, such as "At least 256×256px".',
  },
  pictureMaximumSize: {
    id: 'account.pictureMaximumSize',
    defaultMessage: 'Up to {megabytes} MB',
    description: 'Hint under the picture in the profile picture dialog, the largest file accepted, such as "Up to 2 MB".',
  },
  removePicture: {
    id: 'account.removePicture',
    defaultMessage: 'Remove',
    description: 'Button in the profile picture dialog that takes the reader\'s picture away, leaving their initials.',
  },
  removePictureConfirm: {
    id: 'account.removePictureConfirm',
    defaultMessage: 'Confirm?',
    description: 'What the remove button in the profile picture dialog says after its first click, asking to be clicked again to go ahead.',
  },
  applyPicture: {
    id: 'account.applyPicture',
    defaultMessage: 'Apply',
    description: 'Button in the profile picture dialog that puts the chosen picture on the profile card, to be saved with the rest.',
  },
  closeDialog: {
    id: 'account.closeDialog',
    defaultMessage: 'Close',
    description: 'Accessible label of the button in the corner of the profile picture dialog that closes it.',
  },
  pictureTypeError: {
    id: 'account.pictureTypeError',
    defaultMessage: 'Choose a PNG, JPEG, GIF or WebP picture.',
    description: 'Error in the profile picture dialog when the chosen file is not one of the picture formats accepted.',
  },
  pictureSizeError: {
    id: 'account.pictureSizeError',
    defaultMessage: 'Choose a picture of {megabytes} MB or less.',
    description: 'Error in the profile picture dialog when the chosen file is larger than accepted, such as "Choose a picture of 2 MB or less."',
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
  nameTooLong: {
    id: 'account.nameTooLong',
    defaultMessage: 'Keep your name to {maxNameLength} characters.',
    description: 'Error under the name field on the profile tab when the reader has changed their name to one longer than allowed, such as "Keep your name to 80 characters."',
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
  googleOnlyTitle: {
    id: 'account.googleOnlyTitle',
    defaultMessage: 'You sign in with Google',
    description: 'Title of the notice on the security tab for a reader whose account has no password, only Google sign-in.',
  },
  googleOnlyDescription: {
    id: 'account.googleOnlyDescription',
    defaultMessage: 'Your account has no password, so there is nothing to change here. Manage sign-in from your Google account.',
    description: 'Notice on the security tab for a reader whose account has no password, only Google sign-in.',
  },
  changePasswordTitle: {
    id: 'account.changePasswordTitle',
    defaultMessage: 'Change password',
    description: 'Title of the card on the security tab where the reader changes their password.',
  },
  changePasswordDescription: {
    id: 'account.changePasswordDescription',
    defaultMessage: 'You will stay signed in on this device. Other sessions will be signed out.',
    description: 'Explanation under the title of the change password card, saying what changing the password does to the reader\'s other signed in browsers and devices.',
  },
  currentPasswordLabel: {
    id: 'account.currentPasswordLabel',
    defaultMessage: 'Current password',
    description: 'Label of the field where the reader types the password they sign in with today.',
  },
  currentPasswordRequired: {
    id: 'account.currentPasswordRequired',
    defaultMessage: 'Enter your current password.',
    description: 'Error under the current password field when the reader tries to change their password without typing it.',
  },
  newPasswordLabel: {
    id: 'account.newPasswordLabel',
    defaultMessage: 'New password',
    description: 'Label of the field where the reader types the password they want to sign in with from now on.',
  },
  newPasswordHint: {
    id: 'account.newPasswordHint',
    defaultMessage: 'At least {minPasswordLength} characters.',
    description: 'Hint under the new password field, such as "At least 8 characters."',
  },
  newPasswordUnchanged: {
    id: 'account.newPasswordUnchanged',
    defaultMessage: 'Choose a password different from your current one.',
    description: 'Error under the new password field when it is the same as the current password.',
  },
  confirmNewPasswordLabel: {
    id: 'account.confirmNewPasswordLabel',
    defaultMessage: 'Confirm new password',
    description: 'Label of the field where the reader types their new password a second time.',
  },
  updatePassword: {
    id: 'account.updatePassword',
    defaultMessage: 'Update password',
    description: 'Button that changes the reader\'s password.',
  },
  passwordUpdated: {
    id: 'account.passwordUpdated',
    defaultMessage: 'Password updated',
    description: 'Notification shown once the reader\'s password has been changed.',
  },
  passwordResetSent: {
    id: 'account.passwordResetSent',
    defaultMessage: 'We sent a link to reset your password to {email}.',
    description: 'Notification shown after the reader asked for a password reset from the security tab, such as "We sent a link to reset your password to astrid@example.com."',
  },
})

export default accountMessages
