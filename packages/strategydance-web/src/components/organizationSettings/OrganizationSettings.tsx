import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { DEFAULT_ORGANIZATION_COLOR, MAX_ORGANIZATION_NAME_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { ColorPicker } from 'strategydance-design-system/components/ui/ColorPicker'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { Organization } from '~types'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'
import ContainerLayout from '~components/layout/ContainerLayout'
import OrganizationSettingsBanner from '~components/organizationSettings/OrganizationSettingsBanner'
import OrganizationSettingsHeader from '~components/organizationSettings/OrganizationSettingsHeader'
import OrganizationSettingsLogo from '~components/organizationSettings/OrganizationSettingsLogo'

import organizationSettingsMessages from '~data/intl/messages/organizationSettings'

type Props = {
  organization: Organization
}

/*
  How the organization appears to its team, others and agents, for one of its administrators to
  change: one card, one form, saved or discarded together.

  The form starts from the organization and is compared to it on every render, so it reads as
  changed or not without an effect, and as saved the moment the memberships show what was sent.
  The route keys it by the organization, so switching to another starts it over
*/
function OrganizationSettings({ organization }: Props) {
  const { formatMessage } = useIntl()
  const { updateOrganization } = useUserOrganizations()

  const savedColor = organization.color ?? DEFAULT_ORGANIZATION_COLOR

  const [name, setName] = useState(organization.name)
  const [color, setColor] = useState(savedColor)
  const [isSaving, setIsSaving] = useState(false)

  const trimmedName = name.trim()
  const isColorChanged = color !== savedColor
  // Anything to discard, spaces around the name included
  const isDirty = name !== organization.name || isColorChanged
  // Anything to save, which spaces alone are not
  const hasChanges = trimmedName !== organization.name || isColorChanged
  const canSave = hasChanges && !!trimmedName && !isSaving

  function discardChanges() {
    setName(organization.name)
    setColor(savedColor)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) return

    setIsSaving(true)

    try {
      // An untouched color is sent as stored, so one never picked stays the default
      await updateOrganization(organization.id, trimmedName, isColorChanged ? color : organization.color ?? null)

      // What was saved, without the spaces the server was never sent
      setName(trimmedName)

      toast.success(formatMessage(organizationSettingsMessages.saved))
    }
    catch (error) {
      console.error('Failed to save the organization\'s settings', error)

      // What was typed stays where it was typed
      toast.error(formatMessage(organizationSettingsMessages.saveError))
    }
    finally {
      setIsSaving(false)
    }
  }

  return (
    <ContainerLayout className="gap-8">
      <OrganizationSettingsHeader />
      <form
        onSubmit={handleSubmit}
        className="rounded-xs border border-border bg-white"
      >
        <OrganizationSettingsBanner
          src={organization.bannerUrl}
          alt={formatMessage(organizationSettingsMessages.bannerAlt, { organizationName: organization.name })}
        />
        <div className="flex flex-col items-center gap-8 px-5 pb-6 md:px-8 md:pb-8">
          <OrganizationSettingsLogo
            // An emptied field keeps the saved name's initials rather than none
            name={trimmedName || organization.name}
            logoUrl={organization.logoUrl}
            color={color}
          />
          <Input
            label={formatMessage(organizationSettingsMessages.nameLabel)}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={formatMessage(organizationSettingsMessages.namePlaceholder)}
            maxLength={MAX_ORGANIZATION_NAME_LENGTH}
            autoComplete="organization"
            required
            className="w-full max-w-100"
          />
          <ColorPicker
            label={formatMessage(organizationSettingsMessages.colorLabel)}
            hexLabel={formatMessage(organizationSettingsMessages.colorHexLabel)}
            value={color}
            onChange={setColor}
            className="w-full max-w-100"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-6 md:px-8 md:pb-8">
          <Button
            variant="transparent"
            disabled={!isDirty || isSaving}
            onClick={discardChanges}
          >
            {formatMessage(organizationSettingsMessages.cancel)}
          </Button>
          <Button
            type="submit"
            disabled={!canSave}
            icon={isSaving ? <Spinner tone="current" /> : undefined}
          >
            {formatMessage(organizationSettingsMessages.save)}
          </Button>
        </div>
      </form>
    </ContainerLayout>
  )
}

export default OrganizationSettings
