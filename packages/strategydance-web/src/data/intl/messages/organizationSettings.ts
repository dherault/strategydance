import { defineMessages } from 'react-intl'

// The organization's settings page: how it appears to its team, others and agents
const organizationSettingsMessages = defineMessages({
  lead: {
    id: 'organizationSettings.lead',
    defaultMessage: 'How your organization appears to your team, others and agents.',
    description: 'Introduction under the title of the organization settings page.',
  },
  noOrganization: {
    id: 'organizationSettings.noOrganization',
    defaultMessage: 'Create an organization from the menu at the top of the sidebar, then set how it appears here.',
    description: 'Notice on the organization settings page when the reader belongs to no organization yet.',
  },
  administratorsOnly: {
    id: 'organizationSettings.administratorsOnly',
    defaultMessage: 'Only an administrator of {organizationName} can change its settings.',
    description: 'Notice on the organization settings page for a member who is not an administrator, such as "Only an administrator of Acme can change its settings."',
  },
  bannerAlt: {
    id: 'organizationSettings.bannerAlt',
    defaultMessage: 'Banner of {organizationName}',
    description: 'Alternative text of the wide picture shown across the top of the organization settings card.',
  },
  nameLabel: {
    id: 'organizationSettings.nameLabel',
    defaultMessage: 'Organization name',
    description: 'Label of the field holding the organization\'s name on the settings page.',
  },
  namePlaceholder: {
    id: 'organizationSettings.namePlaceholder',
    defaultMessage: 'Acme Inc.',
    description: 'Placeholder in the empty organization name field, an example company name.',
  },
  colorLabel: {
    id: 'organizationSettings.colorLabel',
    defaultMessage: 'Primary color',
    description: 'Label of the color picker for the color behind the organization\'s initials, shown where it has no logo.',
  },
  colorHexLabel: {
    id: 'organizationSettings.colorHexLabel',
    defaultMessage: 'Hex color',
    description: 'Accessible label of the text field inside the color picker where a color is typed as six hexadecimal digits.',
  },
  cancel: {
    id: 'organizationSettings.cancel',
    defaultMessage: 'Cancel',
    description: 'Button at the bottom of the organization settings card that discards the changes not saved yet.',
  },
  save: {
    id: 'organizationSettings.save',
    defaultMessage: 'Save changes',
    description: 'Button at the bottom of the organization settings card that saves the changes.',
  },
  saved: {
    id: 'organizationSettings.saved',
    defaultMessage: 'Settings saved',
    description: 'Confirmation shown after the organization\'s settings were saved.',
  },
  saveError: {
    id: 'organizationSettings.saveError',
    defaultMessage: 'The settings could not be saved. Try again.',
    description: 'Error shown when saving the organization\'s settings failed.',
  },
  uploadBanner: {
    id: 'organizationSettings.uploadBanner',
    defaultMessage: 'Upload banner',
    description: 'Button on the organization settings card, and title of its dialog, for adding a wide picture across the top when there is none.',
  },
  changeBanner: {
    id: 'organizationSettings.changeBanner',
    defaultMessage: 'Change banner',
    description: 'Button on the organization settings card, and title of its dialog, for replacing or removing the wide picture across the top.',
  },
  uploadLogo: {
    id: 'organizationSettings.uploadLogo',
    defaultMessage: 'Upload logo',
    description: 'Accessible label of the organization\'s square mark on the settings card, and title of its dialog, when it has no logo yet.',
  },
  changeLogo: {
    id: 'organizationSettings.changeLogo',
    defaultMessage: 'Change logo',
    description: 'Accessible label of the organization\'s logo on the settings card, and title of its dialog, for replacing or removing it.',
  },
  bannerDescription: {
    id: 'organizationSettings.bannerDescription',
    defaultMessage: 'Shown across the top of your organization page.',
    description: 'Description in the dialog for choosing the organization\'s banner, the wide picture across the top.',
  },
  logoDescription: {
    id: 'organizationSettings.logoDescription',
    defaultMessage: 'Appears next to your organization\'s name.',
    description: 'Description in the dialog for choosing the organization\'s logo.',
  },
  chooseBanner: {
    id: 'organizationSettings.chooseBanner',
    defaultMessage: 'Choose a banner picture',
    description: 'Accessible label of the area in the banner dialog that opens the file picker, or takes a file dragged onto it.',
  },
  chooseLogo: {
    id: 'organizationSettings.chooseLogo',
    defaultMessage: 'Choose a logo picture',
    description: 'Accessible label of the area in the logo dialog that opens the file picker, or takes a file dragged onto it.',
  },
  dropPrompt: {
    id: 'organizationSettings.dropPrompt',
    defaultMessage: '<strong>Choose a file</strong> or drag it here',
    description: 'Text inside the empty area of the banner or logo dialog. The part in the strong tag is highlighted, since clicking the area opens the file picker.',
  },
  bannerPreviewAlt: {
    id: 'organizationSettings.bannerPreviewAlt',
    defaultMessage: 'Banner preview',
    description: 'Alternative text of the chosen banner as the dialog previews it before it is applied.',
  },
  logoPreviewAlt: {
    id: 'organizationSettings.logoPreviewAlt',
    defaultMessage: 'Logo preview',
    description: 'Alternative text of the chosen logo as the dialog previews it before it is applied.',
  },
  wideRatio: {
    id: 'organizationSettings.wideRatio',
    defaultMessage: '4:1 ratio',
    description: 'Hint under the banner dialog\'s picture: it should be four times as wide as it is tall.',
  },
  squareRatio: {
    id: 'organizationSettings.squareRatio',
    defaultMessage: 'Square',
    description: 'Hint under the logo dialog\'s picture: it should be as wide as it is tall.',
  },
  minimumSize: {
    id: 'organizationSettings.minimumSize',
    defaultMessage: 'At least {width}×{height}px',
    description: 'Hint under the picture in the banner or logo dialog, its smallest recommended size in pixels, such as "At least 2400×600px".',
  },
  maximumSize: {
    id: 'organizationSettings.maximumSize',
    defaultMessage: 'Up to {megabytes} MB',
    description: 'Hint under the picture in the banner or logo dialog, the largest file accepted, such as "Up to 5 MB".',
  },
  imageTypeError: {
    id: 'organizationSettings.imageTypeError',
    defaultMessage: 'Choose a PNG, JPEG, GIF or WebP picture.',
    description: 'Error in the banner or logo dialog when the chosen file is not one of the picture formats accepted.',
  },
  imageSizeError: {
    id: 'organizationSettings.imageSizeError',
    defaultMessage: 'Choose a picture of {megabytes} MB or less.',
    description: 'Error in the banner or logo dialog when the chosen file is larger than accepted, such as "Choose a picture of 2 MB or less."',
  },
  remove: {
    id: 'organizationSettings.remove',
    defaultMessage: 'Remove',
    description: 'Button in the banner or logo dialog that takes the picture away.',
  },
  removeConfirm: {
    id: 'organizationSettings.removeConfirm',
    defaultMessage: 'Confirm?',
    description: 'What the remove button in the banner or logo dialog says after its first click, asking to be clicked again to go ahead.',
  },
  apply: {
    id: 'organizationSettings.apply',
    defaultMessage: 'Apply',
    description: 'Button in the banner or logo dialog that puts the chosen picture on the settings card, to be saved with the rest.',
  },
  deleteOrganization: {
    id: 'organizationSettings.deleteOrganization',
    defaultMessage: 'Delete organization',
    description: 'Button at the bottom of the organization settings card that opens the dialog for deleting the organization, and that dialog\'s title and button.',
  },
  deleteDescription: {
    id: 'organizationSettings.deleteDescription',
    defaultMessage: 'This permanently deletes {organizationName}, its members, content, tasks and agents. This cannot be undone.',
    description: 'Warning in the dialog for deleting the organization, such as "This permanently deletes Acme, its members, content, tasks and agents."',
  },
  deleteConfirm: {
    id: 'organizationSettings.deleteConfirm',
    defaultMessage: 'Confirm?',
    description: 'What the delete button in the dialog for deleting the organization says after its first click, asking to be clicked again to go ahead.',
  },
  deleted: {
    id: 'organizationSettings.deleted',
    defaultMessage: 'Organization deleted',
    description: 'Confirmation shown after the organization was deleted.',
  },
  deleteError: {
    id: 'organizationSettings.deleteError',
    defaultMessage: 'The organization could not be deleted. Try again.',
    description: 'Error shown when deleting the organization failed.',
  },
  close: {
    id: 'organizationSettings.close',
    defaultMessage: 'Close',
    description: 'Accessible label of the button in the corner of a dialog on the organization settings page that closes it.',
  },
})

export default organizationSettingsMessages
