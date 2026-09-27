import { defineMessages } from 'react-intl'

// The organization's profile page: how it appears to its team, the community and agents
const organizationProfileMessages = defineMessages({
  eyebrow: {
    id: 'organizationProfile.eyebrow',
    defaultMessage: 'Show and tell',
    description: 'Small uppercase label above the title of the organization profile page, a playful nod to the page being about how the organization presents itself.',
  },
  title: {
    id: 'organizationProfile.title',
    defaultMessage: 'Company profile',
    description: 'Title of the page where administrators set how their organization appears to others.',
  },
  lead: {
    id: 'organizationProfile.lead',
    defaultMessage: 'How your organization appears to your team, the community and agents.',
    description: 'Introduction under the title of the organization profile page.',
  },
  administratorsOnly: {
    id: 'organizationProfile.administratorsOnly',
    defaultMessage: 'Only an administrator of {organizationName} can change its profile.',
    description: 'Notice on the organization profile page for a member who is not an administrator, such as "Only an administrator of Acme can change its profile."',
  },
  bannerAlt: {
    id: 'organizationProfile.bannerAlt',
    defaultMessage: 'Banner of {organizationName}',
    description: 'Alternative text of the wide picture shown across the top of the organization profile card.',
  },
  nameLabel: {
    id: 'organizationProfile.nameLabel',
    defaultMessage: 'Organization name',
    description: 'Label of the field holding the organization\'s name on the profile page.',
  },
  namePlaceholder: {
    id: 'organizationProfile.namePlaceholder',
    defaultMessage: 'Acme Inc.',
    description: 'Placeholder in the empty organization name field, an example company name.',
  },
  briefLabel: {
    id: 'organizationProfile.briefLabel',
    defaultMessage: 'Brief',
    description: 'Label of the field holding a short summary of the company on its profile page: what it does, for whom, and where it is headed. Worded apart from the page\'s "Show and tell" label above its title.',
  },
  briefPlaceholder: {
    id: 'organizationProfile.briefPlaceholder',
    defaultMessage: 'What your company does, for whom, and where it is headed.',
    description: 'Placeholder in the empty brief field on the organization profile page.',
  },
  briefCount: {
    id: 'organizationProfile.briefCount',
    defaultMessage: '{count, number}/{max, number}',
    description: 'Counter under the brief field, how many characters were typed out of how many are allowed, such as "42/500".',
  },
  colorLabel: {
    id: 'organizationProfile.colorLabel',
    defaultMessage: 'Primary color',
    description: 'Label of the color picker for the color behind the organization\'s initials, shown where it has no logo.',
  },
  colorHexLabel: {
    id: 'organizationProfile.colorHexLabel',
    defaultMessage: 'Hex color',
    description: 'Accessible label of the text field inside the color picker where a color is typed as six hexadecimal digits.',
  },
  publicLabel: {
    id: 'organizationProfile.publicLabel',
    defaultMessage: 'Public profile',
    description: 'Label of the switch on the organization profile page that makes the profile visible to anybody, or only to the organization\'s members.',
  },
  publicHintPublic: {
    id: 'organizationProfile.publicHintPublic',
    defaultMessage: 'Anyone can see your name, logo, banner and brief.',
    description: 'Hint under the public profile switch while it is on, saying what anybody outside the organization can see.',
  },
  publicHintPrivate: {
    id: 'organizationProfile.publicHintPrivate',
    defaultMessage: 'Only members of your organization can see this profile.',
    description: 'Hint under the public profile switch while it is off.',
  },
  cancel: {
    id: 'organizationProfile.cancel',
    defaultMessage: 'Cancel',
    description: 'Button at the bottom of the organization profile card that discards the changes not saved yet.',
  },
  save: {
    id: 'organizationProfile.save',
    defaultMessage: 'Save changes',
    description: 'Button at the bottom of the organization profile card that saves the changes.',
  },
  saved: {
    id: 'organizationProfile.saved',
    defaultMessage: 'Organization saved',
    description: 'Confirmation shown after the organization\'s profile was saved.',
  },
  saveError: {
    id: 'organizationProfile.saveError',
    defaultMessage: 'The organization could not be saved. Try again.',
    description: 'Error shown when saving the organization\'s profile failed.',
  },
  uploadBanner: {
    id: 'organizationProfile.uploadBanner',
    defaultMessage: 'Upload banner',
    description: 'Button on the organization profile card, and title of its dialog, for adding a wide picture across the top when there is none.',
  },
  changeBanner: {
    id: 'organizationProfile.changeBanner',
    defaultMessage: 'Change banner',
    description: 'Button on the organization profile card, and title of its dialog, for replacing or removing the wide picture across the top.',
  },
  uploadLogo: {
    id: 'organizationProfile.uploadLogo',
    defaultMessage: 'Upload logo',
    description: 'Accessible label of the organization\'s square mark on the profile card, and title of its dialog, when it has no logo yet.',
  },
  changeLogo: {
    id: 'organizationProfile.changeLogo',
    defaultMessage: 'Change logo',
    description: 'Accessible label of the organization\'s logo on the profile card, and title of its dialog, for replacing or removing it.',
  },
  bannerDescription: {
    id: 'organizationProfile.bannerDescription',
    defaultMessage: 'Shown across the top of your organization page.',
    description: 'Description in the dialog for choosing the organization\'s banner, the wide picture across the top.',
  },
  logoDescription: {
    id: 'organizationProfile.logoDescription',
    defaultMessage: 'Appears next to your organization\'s name.',
    description: 'Description in the dialog for choosing the organization\'s logo.',
  },
  chooseBanner: {
    id: 'organizationProfile.chooseBanner',
    defaultMessage: 'Choose a banner picture',
    description: 'Accessible label of the area in the banner dialog that opens the file picker, or takes a file dragged onto it.',
  },
  chooseLogo: {
    id: 'organizationProfile.chooseLogo',
    defaultMessage: 'Choose a logo picture',
    description: 'Accessible label of the area in the logo dialog that opens the file picker, or takes a file dragged onto it.',
  },
  dropPrompt: {
    id: 'organizationProfile.dropPrompt',
    defaultMessage: '<strong>Choose a file</strong> or drag it here',
    description: 'Text inside the empty area of the banner or logo dialog. The part in the strong tag is highlighted, since clicking the area opens the file picker.',
  },
  bannerPreviewAlt: {
    id: 'organizationProfile.bannerPreviewAlt',
    defaultMessage: 'Banner preview',
    description: 'Alternative text of the chosen banner as the dialog previews it before it is applied.',
  },
  logoPreviewAlt: {
    id: 'organizationProfile.logoPreviewAlt',
    defaultMessage: 'Logo preview',
    description: 'Alternative text of the chosen logo as the dialog previews it before it is applied.',
  },
  wideRatio: {
    id: 'organizationProfile.wideRatio',
    defaultMessage: '4:1 ratio',
    description: 'Hint under the banner dialog\'s picture: it should be four times as wide as it is tall.',
  },
  squareRatio: {
    id: 'organizationProfile.squareRatio',
    defaultMessage: 'Square',
    description: 'Hint under the logo dialog\'s picture: it should be as wide as it is tall.',
  },
  minimumSize: {
    id: 'organizationProfile.minimumSize',
    defaultMessage: 'At least {width}×{height}px',
    description: 'Hint under the picture in the banner or logo dialog, its smallest recommended size in pixels, such as "At least 2400×600px".',
  },
  maximumSize: {
    id: 'organizationProfile.maximumSize',
    defaultMessage: 'Up to {megabytes} MB',
    description: 'Hint under the picture in the banner or logo dialog, the largest file accepted, such as "Up to 5 MB".',
  },
  imageTypeError: {
    id: 'organizationProfile.imageTypeError',
    defaultMessage: 'Choose a PNG, JPEG, GIF or WebP picture.',
    description: 'Error in the banner or logo dialog when the chosen file is not one of the picture formats accepted.',
  },
  imageSizeError: {
    id: 'organizationProfile.imageSizeError',
    defaultMessage: 'Choose a picture of {megabytes} MB or less.',
    description: 'Error in the banner or logo dialog when the chosen file is larger than accepted, such as "Choose a picture of 2 MB or less."',
  },
  remove: {
    id: 'organizationProfile.remove',
    defaultMessage: 'Remove',
    description: 'Button in the banner or logo dialog that takes the picture away.',
  },
  removeConfirm: {
    id: 'organizationProfile.removeConfirm',
    defaultMessage: 'Confirm?',
    description: 'What the remove button in the banner or logo dialog says after its first click, asking to be clicked again to go ahead.',
  },
  apply: {
    id: 'organizationProfile.apply',
    defaultMessage: 'Apply',
    description: 'Button in the banner or logo dialog that puts the chosen picture on the profile card, to be saved with the rest.',
  },
  deleteOrganization: {
    id: 'organizationProfile.deleteOrganization',
    defaultMessage: 'Delete organization',
    description: 'Button at the bottom of the organization profile card that opens the dialog for deleting the organization, and that dialog\'s title and button.',
  },
  deleteDescription: {
    id: 'organizationProfile.deleteDescription',
    defaultMessage: 'This permanently deletes {organizationName}, its members, content, tasks and agents. This cannot be undone.',
    description: 'Warning in the dialog for deleting the organization, such as "This permanently deletes Acme, its members, content, tasks and agents."',
  },
  deleteConfirm: {
    id: 'organizationProfile.deleteConfirm',
    defaultMessage: 'Confirm?',
    description: 'What the delete button in the dialog for deleting the organization says after its first click, asking to be clicked again to go ahead.',
  },
  deleted: {
    id: 'organizationProfile.deleted',
    defaultMessage: 'Organization deleted',
    description: 'Confirmation shown after the organization was deleted.',
  },
  deleteError: {
    id: 'organizationProfile.deleteError',
    defaultMessage: 'The organization could not be deleted. Try again.',
    description: 'Error shown when deleting the organization failed.',
  },
  close: {
    id: 'organizationProfile.close',
    defaultMessage: 'Close',
    description: 'Accessible label of the button in the corner of a dialog on the organization profile page that closes it.',
  },
})

export default organizationProfileMessages
