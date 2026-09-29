import { PencilIcon, UploadIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import {
  DEFAULT_ORGANIZATION_COLOR,
  MAX_ORGANIZATION_BRIEF_LENGTH,
  MAX_ORGANIZATION_NAME_LENGTH,
  type OrganizationImageKind,
} from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { ColorPicker } from 'strategydance-design-system/components/ui/ColorPicker'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { Organization } from '~types'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'
import ContainerLayout from '~components/layout/ContainerLayout'
import OrganizationProfileBanner from '~components/organizationProfile/OrganizationProfileBanner'
import OrganizationProfileDeleteDialog from '~components/organizationProfile/OrganizationProfileDeleteDialog'
import OrganizationProfileHeader from '~components/organizationProfile/OrganizationProfileHeader'
import OrganizationProfileImageDialog from '~components/organizationProfile/OrganizationProfileImageDialog'
import OrganizationProfileLogo from '~components/organizationProfile/OrganizationProfileLogo'
import OrganizationProfileVisibility from '~components/organizationProfile/OrganizationProfileVisibility'

import organizationProfileMessages from '~data/intl/messages/organizationProfile'

type Props = {
  organization: Organization
}

/*
  How the organization appears to its team, the community and agents, for one of its
  administrators to change: one card, its name, color, brief and visibility one form, saved or
  discarded together.

  The form starts from the organization and is compared to it on every render, so it reads as
  changed or not without an effect, and as saved the moment the memberships show what was sent.
  The route keys it by the organization, so switching to another starts it over.

  The banner and the logo are not part of the form: each is saved from its dialog as soon as it is
  chosen, and the card shows what is saved. The logo is still drawn in the form's name and color,
  so its initials follow them before they are saved
*/
function OrganizationProfile({ organization }: Props) {
  const { formatMessage } = useIntl()
  const { updateOrganization } = useUserOrganizations()

  const savedColor = organization.color ?? DEFAULT_ORGANIZATION_COLOR
  const savedBrief = organization.brief ?? ''

  const [name, setName] = useState(organization.name)
  const [color, setColor] = useState(savedColor)
  const [brief, setBrief] = useState(savedBrief)
  const [isPublic, setIsPublic] = useState(organization.isPublic)
  const [editingImage, setEditingImage] = useState<OrganizationImageKind | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Makes the name and the brief read-only while a save is in flight, since a success puts what
  // was sent back in them: anything typed meanwhile would be lost
  const [isSaving, setIsSaving] = useState(false)

  const trimmedName = name.trim()
  const trimmedBrief = brief.trim()
  const isColorChanged = color !== savedColor
  const isVisibilityChanged = isPublic !== organization.isPublic
  const areDetailsChanged =
    trimmedName !== organization.name || isColorChanged || trimmedBrief !== savedBrief || isVisibilityChanged
  // Anything to discard, spaces around the name and the brief included
  const isDirty = name !== organization.name || isColorChanged || brief !== savedBrief || isVisibilityChanged
  // Anything to save, which spaces alone are not
  const canSave = areDetailsChanged && !!trimmedName && !isSaving

  const logoSrc = organization.logoUrl ?? null
  const bannerSrc = organization.bannerUrl ?? null

  function discardChanges() {
    setName(organization.name)
    setColor(savedColor)
    setBrief(savedBrief)
    setIsPublic(organization.isPublic)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) return

    setIsSaving(true)

    try {
      // An untouched color is sent as stored, so one never picked stays the default
      await updateOrganization(organization.id, {
        name: trimmedName,
        color: isColorChanged ? color : (organization.color ?? null),
        brief: trimmedBrief || null,
        isPublic,
      })

      // What was saved, without the spaces the server was never sent
      setName(trimmedName)
      setBrief(trimmedBrief)

      toast.success(formatMessage(organizationProfileMessages.saved))
    } catch (error) {
      console.error("Failed to save the organization's profile", error)

      // What was not saved stays where it was typed
      toast.error(formatMessage(organizationProfileMessages.saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ContainerLayout className="gap-8">
      <OrganizationProfileHeader />
      <form
        onSubmit={handleSubmit}
        className="rounded-xs border border-border bg-white"
      >
        <OrganizationProfileBanner
          src={bannerSrc}
          alt={formatMessage(organizationProfileMessages.bannerAlt, { organizationName: organization.name })}
        >
          <Button
            variant="secondary"
            size="sm"
            icon={bannerSrc ? <PencilIcon /> : <UploadIcon />}
            disabled={isSaving}
            onClick={() => setEditingImage('banner')}
          >
            {formatMessage(
              bannerSrc ? organizationProfileMessages.changeBanner : organizationProfileMessages.uploadBanner,
            )}
          </Button>
        </OrganizationProfileBanner>
        <div className="flex flex-col items-center gap-8 px-5 pb-6 md:px-8 md:pb-8">
          <OrganizationProfileLogo
            // An emptied field keeps the saved name's initials rather than none
            name={trimmedName || organization.name}
            logoUrl={logoSrc}
            color={color}
            label={formatMessage(
              logoSrc ? organizationProfileMessages.changeLogo : organizationProfileMessages.uploadLogo,
            )}
            disabled={isSaving}
            onClick={() => setEditingImage('logo')}
          />
          <Input
            label={formatMessage(organizationProfileMessages.nameLabel)}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={formatMessage(organizationProfileMessages.namePlaceholder)}
            maxLength={MAX_ORGANIZATION_NAME_LENGTH}
            autoComplete="organization"
            required
            readOnly={isSaving}
            className="w-full max-w-100"
          />
          <Textarea
            label={formatMessage(organizationProfileMessages.briefLabel)}
            value={brief}
            onChange={event => setBrief(event.target.value)}
            placeholder={formatMessage(organizationProfileMessages.briefPlaceholder)}
            maxLength={MAX_ORGANIZATION_BRIEF_LENGTH}
            rows={4}
            autosize
            readOnly={isSaving}
            hint={
              <span className="flex justify-end tabular-nums">
                {formatMessage(organizationProfileMessages.briefCount, {
                  count: brief.length,
                  max: MAX_ORGANIZATION_BRIEF_LENGTH,
                })}
              </span>
            }
            className="w-full max-w-100"
          />
          <ColorPicker
            label={formatMessage(organizationProfileMessages.colorLabel)}
            hexLabel={formatMessage(organizationProfileMessages.colorHexLabel)}
            value={color}
            onChange={setColor}
            className="-mt-5.5 mb-6.5 w-full max-w-100"
          />
          <OrganizationProfileVisibility
            isPublic={isPublic}
            disabled={isSaving}
            onChange={setIsPublic}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-6 md:px-8 md:pb-8">
          <Button
            variant="danger"
            disabled={isSaving}
            onClick={() => setIsDeleting(true)}
            className="mr-auto"
          >
            {formatMessage(organizationProfileMessages.deleteOrganization)}
          </Button>
          <Button
            variant="transparent"
            disabled={!isDirty || isSaving}
            onClick={discardChanges}
          >
            {formatMessage(organizationProfileMessages.cancel)}
          </Button>
          <Button
            type="submit"
            disabled={!canSave}
            icon={isSaving ? <Spinner tone="current" /> : undefined}
          >
            {formatMessage(organizationProfileMessages.save)}
          </Button>
        </div>
      </form>
      {editingImage ? (
        <OrganizationProfileImageDialog
          organizationId={organization.id}
          kind={editingImage}
          currentSrc={editingImage === 'logo' ? logoSrc : bannerSrc}
          onClose={() => setEditingImage(null)}
        />
      ) : null}
      {isDeleting ? (
        <OrganizationProfileDeleteDialog
          organizationId={organization.id}
          organizationName={organization.name}
          onClose={() => setIsDeleting(false)}
        />
      ) : null}
    </ContainerLayout>
  )
}

export default OrganizationProfile
