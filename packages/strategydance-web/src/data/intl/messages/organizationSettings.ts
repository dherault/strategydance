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
})

export default organizationSettingsMessages
