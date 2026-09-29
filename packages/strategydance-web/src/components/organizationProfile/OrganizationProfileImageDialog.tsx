import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import {
  MAX_ORGANIZATION_IMAGE_SIZES,
  ORGANIZATION_IMAGE_CONTENT_TYPES,
  type OrganizationImageKind,
} from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { ImageDropzone } from 'strategydance-design-system/components/ui/ImageDropzone'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useStagedImage from '~hooks/common/useStagedImage'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Spinner from '~components/common/Spinner'

import organizationProfileMessages from '~data/intl/messages/organizationProfile'

// What each picture should measure, as the dialog advises. Advice only: nothing refuses a smaller
// picture, since each is cropped to fill its band or its square
const MINIMUM_SIZES: Record<OrganizationImageKind, { width: number; height: number }> = {
  banner: { width: 2400, height: 600 },
  logo: { width: 256, height: 256 },
}

type Props = {
  organizationId: string
  kind: OrganizationImageKind
  // The picture saved now, if any
  currentSrc: string | null
  onClose: () => void
}

/*
  Chooses the organization's banner or logo, or removes it, and saves that the moment it is
  confirmed, apart from the profile's form. Mounted only while open, so it starts from what is
  saved every time.

  It stays open until the save lands, and cannot be dismissed meanwhile, so a failure keeps the
  choice for another try. The type and size are checked here, before anything is sent, and the
  backend checks both again
*/
function OrganizationProfileImageDialog({ organizationId, kind, currentSrc, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { changeOrganizationImage } = useUserOrganizations()
  const { staged: choice, stage } = useStagedImage()

  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isBanner = kind === 'banner'
  const maximumMegabytes = MAX_ORGANIZATION_IMAGE_SIZES[kind] / (1024 * 1024)
  const { width, height } = MINIMUM_SIZES[kind]
  const src = choice === undefined ? currentSrc : (choice?.url ?? null)
  // Removing a picture that was never there changes nothing
  const isChanged = choice !== undefined && (choice !== null || currentSrc !== null)

  function selectFile(file: File) {
    if (!ORGANIZATION_IMAGE_CONTENT_TYPES.includes(file.type)) {
      setError(formatMessage(organizationProfileMessages.imageTypeError))

      return
    }

    if (file.size > MAX_ORGANIZATION_IMAGE_SIZES[kind]) {
      setError(formatMessage(organizationProfileMessages.imageSizeError, { megabytes: maximumMegabytes }))

      return
    }

    setError(null)
    stage(file)
  }

  function remove() {
    setError(null)
    stage(null)
  }

  /*
    Sends the blob rather than the preview's URL, which this dialog revokes as it closes, and
    closes once the list shows the new picture, which is when the card does
  */
  async function save() {
    if (isSaving) return

    setIsSaving(true)

    try {
      await changeOrganizationImage(organizationId, kind, choice ? choice.blob : null)
    } catch (saveError) {
      console.error(`Failed to save the organization's ${kind}`, saveError)

      toast.error(formatMessage(organizationProfileMessages.imageSaveError))
      setIsSaving(false)

      return
    }

    toast.success(
      formatMessage(
        isBanner
          ? choice
            ? organizationProfileMessages.bannerSaved
            : organizationProfileMessages.bannerRemoved
          : choice
            ? organizationProfileMessages.logoSaved
            : organizationProfileMessages.logoRemoved,
      ),
    )
    onClose()
  }

  const specs = [
    formatMessage(isBanner ? organizationProfileMessages.wideRatio : organizationProfileMessages.squareRatio),
    formatMessage(organizationProfileMessages.minimumSize, { width, height }),
    formatMessage(organizationProfileMessages.maximumSize, { megabytes: maximumMegabytes }),
  ]

  return (
    <Dialog
      open
      onOpenChange={open => !open && !isSaving && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(organizationProfileMessages.close)}
        className={isBanner ? 'sm:max-w-[560px]' : 'sm:max-w-[420px]'}
      >
        <DialogHeader>
          <DialogTitle>
            {isBanner
              ? formatMessage(
                  currentSrc ? organizationProfileMessages.changeBanner : organizationProfileMessages.uploadBanner,
                )
              : formatMessage(
                  currentSrc ? organizationProfileMessages.changeLogo : organizationProfileMessages.uploadLogo,
                )}
          </DialogTitle>
          <DialogDescription>
            {formatMessage(
              isBanner ? organizationProfileMessages.bannerDescription : organizationProfileMessages.logoDescription,
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <ImageDropzone
            shape={isBanner ? 'wide' : 'square'}
            src={src}
            alt={formatMessage(
              isBanner ? organizationProfileMessages.bannerPreviewAlt : organizationProfileMessages.logoPreviewAlt,
            )}
            label={formatMessage(
              isBanner ? organizationProfileMessages.chooseBanner : organizationProfileMessages.chooseLogo,
            )}
            prompt={
              <FormattedMessage
                {...organizationProfileMessages.dropPrompt}
                values={{
                  strong: chunks => <strong>{chunks}</strong>,
                }}
              />
            }
            accept={ORGANIZATION_IMAGE_CONTENT_TYPES.join(',')}
            onFileSelect={selectFile}
            disabled={isSaving}
          />
          {error ? (
            <p
              role="alert"
              className="m-0 text-center text-xs text-danger"
            >
              {error}
            </p>
          ) : null}
          <ul className="m-0 flex list-none flex-wrap justify-center gap-x-2 gap-y-1 p-0 text-xs text-muted-foreground">
            {specs.map((spec, index) => (
              <li
                key={spec}
                className={index ? 'before:mr-2 before:text-neutral-400 before:content-["•"]' : undefined}
              >
                {spec}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4 sm:items-center">
          {src ? (
            <Button
              variant="danger"
              size="sm"
              confirm={formatMessage(organizationProfileMessages.removeConfirm)}
              disabled={isSaving}
              onClick={remove}
              className="sm:mr-auto"
            >
              {formatMessage(organizationProfileMessages.remove)}
            </Button>
          ) : null}
          <Button
            variant="transparent"
            disabled={isSaving}
            onClick={onClose}
          >
            {formatMessage(organizationProfileMessages.cancel)}
          </Button>
          <Button
            disabled={!isChanged || isSaving}
            icon={isSaving ? <Spinner tone="current" /> : undefined}
            onClick={save}
          >
            {formatMessage(organizationProfileMessages.saveImage)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OrganizationProfileImageDialog
