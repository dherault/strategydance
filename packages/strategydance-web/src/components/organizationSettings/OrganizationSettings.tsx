import { PencilIcon, UploadIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { DEFAULT_ORGANIZATION_COLOR, MAX_ORGANIZATION_NAME_LENGTH, type OrganizationImageKind } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { ColorPicker } from 'strategydance-design-system/components/ui/ColorPicker'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { Organization } from '~types'

import useStagedImage from '~hooks/organizationSettings/useStagedImage'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'
import ContainerLayout from '~components/layout/ContainerLayout'
import OrganizationSettingsBanner from '~components/organizationSettings/OrganizationSettingsBanner'
import OrganizationSettingsHeader from '~components/organizationSettings/OrganizationSettingsHeader'
import OrganizationSettingsImageDialog from '~components/organizationSettings/OrganizationSettingsImageDialog'
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
  The route keys it by the organization, so switching to another starts it over.

  A picture chosen in its dialog waits on the card, previewed, until the form is saved. Saving
  sends each picture, then the name and color, one after the other, and each is cleared from the
  form as soon as it lands: a failure halfway keeps only what did not, for the next try
*/
function OrganizationSettings({ organization }: Props) {
  const { formatMessage } = useIntl()
  const { updateOrganization, changeOrganizationImage } = useUserOrganizations()
  const { staged: stagedLogo, stage: stageLogo, unstage: unstageLogo } = useStagedImage()
  const { staged: stagedBanner, stage: stageBanner, unstage: unstageBanner } = useStagedImage()

  const savedColor = organization.color ?? DEFAULT_ORGANIZATION_COLOR

  const [name, setName] = useState(organization.name)
  const [color, setColor] = useState(savedColor)
  const [editingImage, setEditingImage] = useState<OrganizationImageKind | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const trimmedName = name.trim()
  const isColorChanged = color !== savedColor
  const areDetailsChanged = trimmedName !== organization.name || isColorChanged
  const areImagesChanged = stagedLogo !== undefined || stagedBanner !== undefined
  // Anything to discard, spaces around the name included
  const isDirty = name !== organization.name || isColorChanged || areImagesChanged
  // Anything to save, which spaces alone are not
  const canSave = (areDetailsChanged || areImagesChanged) && !!trimmedName && !isSaving

  // What the card shows: a picture chosen and not saved yet, or else the saved one
  const logoSrc = stagedLogo === undefined ? organization.logoUrl ?? null : stagedLogo?.url ?? null
  const bannerSrc = stagedBanner === undefined ? organization.bannerUrl ?? null : stagedBanner?.url ?? null

  function discardChanges() {
    setName(organization.name)
    setColor(savedColor)
    unstageLogo()
    unstageBanner()
  }

  /*
    Stages what the dialog applied. Removing a picture that is not saved, only chosen, is going
    back to nothing chosen rather than a removal to send
  */
  function applyImage(kind: OrganizationImageKind, image: Blob | null) {
    const savedUrl = kind === 'logo' ? organization.logoUrl : organization.bannerUrl
    const stage = kind === 'logo' ? stageLogo : stageBanner
    const unstage = kind === 'logo' ? unstageLogo : unstageBanner

    if (image || savedUrl) stage(image)
    else unstage()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) return

    setIsSaving(true)

    try {
      if (stagedBanner !== undefined) {
        await changeOrganizationImage(organization.id, 'banner', stagedBanner?.blob ?? null)
        unstageBanner()
      }

      if (stagedLogo !== undefined) {
        await changeOrganizationImage(organization.id, 'logo', stagedLogo?.blob ?? null)
        unstageLogo()
      }

      if (areDetailsChanged) {
        // An untouched color is sent as stored, so one never picked stays the default
        await updateOrganization(organization.id, trimmedName, isColorChanged ? color : organization.color ?? null)

        // What was saved, without the spaces the server was never sent
        setName(trimmedName)
      }

      toast.success(formatMessage(organizationSettingsMessages.saved))
    }
    catch (error) {
      console.error('Failed to save the organization\'s settings', error)

      // What was not saved stays where it was chosen or typed
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
          src={bannerSrc}
          alt={formatMessage(organizationSettingsMessages.bannerAlt, { organizationName: organization.name })}
        >
          <Button
            variant="secondary"
            size="sm"
            icon={bannerSrc ? <PencilIcon /> : <UploadIcon />}
            disabled={isSaving}
            onClick={() => setEditingImage('banner')}
          >
            {formatMessage(bannerSrc ? organizationSettingsMessages.changeBanner : organizationSettingsMessages.uploadBanner)}
          </Button>
        </OrganizationSettingsBanner>
        <div className="flex flex-col items-center gap-8 px-5 pb-6 md:px-8 md:pb-8">
          <OrganizationSettingsLogo
            // An emptied field keeps the saved name's initials rather than none
            name={trimmedName || organization.name}
            logoUrl={logoSrc}
            color={color}
            label={formatMessage(logoSrc ? organizationSettingsMessages.changeLogo : organizationSettingsMessages.uploadLogo)}
            disabled={isSaving}
            onClick={() => setEditingImage('logo')}
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
      {editingImage
        ? (
            <OrganizationSettingsImageDialog
              kind={editingImage}
              currentSrc={editingImage === 'logo' ? logoSrc : bannerSrc}
              onApply={image => applyImage(editingImage, image)}
              onClose={() => setEditingImage(null)}
            />
          )
        : null}
    </ContainerLayout>
  )
}

export default OrganizationSettings
