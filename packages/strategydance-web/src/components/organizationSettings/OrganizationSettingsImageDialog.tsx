import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { MAX_ORGANIZATION_IMAGE_SIZES, ORGANIZATION_IMAGE_CONTENT_TYPES, type OrganizationImageKind } from 'strategydance-core'
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

import useStagedImage from '~hooks/organizationSettings/useStagedImage'

import organizationSettingsMessages from '~data/intl/messages/organizationSettings'

// What each picture should measure, as the dialog advises. Advice only: nothing refuses a smaller
// picture, since the banner is cropped to fill its band and the logo fitted inside its square
const MINIMUM_SIZES: Record<OrganizationImageKind, { width: number, height: number }> = {
  banner: { width: 2400, height: 600 },
  logo: { width: 256, height: 256 },
}

type Props = {
  kind: OrganizationImageKind
  // What the card shows now, whether saved or chosen earlier and not saved yet
  currentSrc: string | null
  // A picture to put on the card, or null to take the one there away. Saving is the card's
  onApply: (image: Blob | null) => void
  onClose: () => void
}

/*
  Chooses the organization's banner or logo, or removes it. Mounted only while open, so it starts
  from what the card shows every time.

  Applying puts the choice on the card and nothing more: the card saves it with the rest of its
  changes. The type and size are checked here, before anything is sent, and the backend checks
  both again
*/
function OrganizationSettingsImageDialog({ kind, currentSrc, onApply, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { staged: choice, stage } = useStagedImage()

  const [error, setError] = useState<string | null>(null)

  const isBanner = kind === 'banner'
  const maximumMegabytes = MAX_ORGANIZATION_IMAGE_SIZES[kind] / (1024 * 1024)
  const { width, height } = MINIMUM_SIZES[kind]
  const src = choice === undefined ? currentSrc : choice?.url ?? null
  // Removing a picture that was never there changes nothing
  const isChanged = choice !== undefined && (choice !== null || currentSrc !== null)

  function selectFile(file: File) {
    if (!ORGANIZATION_IMAGE_CONTENT_TYPES.includes(file.type)) {
      setError(formatMessage(organizationSettingsMessages.imageTypeError))

      return
    }

    if (file.size > MAX_ORGANIZATION_IMAGE_SIZES[kind]) {
      setError(formatMessage(organizationSettingsMessages.imageSizeError, { megabytes: maximumMegabytes }))

      return
    }

    setError(null)
    stage(file)
  }

  function remove() {
    setError(null)
    stage(null)
  }

  // The blob rather than the preview's URL, which this dialog revokes as it closes
  function apply() {
    onApply(choice ? choice.blob : null)
    onClose()
  }

  const specs = [
    formatMessage(isBanner ? organizationSettingsMessages.wideRatio : organizationSettingsMessages.squareRatio),
    formatMessage(organizationSettingsMessages.minimumSize, { width, height }),
    formatMessage(organizationSettingsMessages.maximumSize, { megabytes: maximumMegabytes }),
  ]

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(organizationSettingsMessages.close)}
        className={isBanner ? 'sm:max-w-[560px]' : 'sm:max-w-[420px]'}
      >
        <DialogHeader>
          <DialogTitle>
            {isBanner
              ? formatMessage(currentSrc ? organizationSettingsMessages.changeBanner : organizationSettingsMessages.uploadBanner)
              : formatMessage(currentSrc ? organizationSettingsMessages.changeLogo : organizationSettingsMessages.uploadLogo)}
          </DialogTitle>
          <DialogDescription>
            {formatMessage(isBanner ? organizationSettingsMessages.bannerDescription : organizationSettingsMessages.logoDescription)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <ImageDropzone
            shape={isBanner ? 'wide' : 'square'}
            src={src}
            alt={formatMessage(isBanner ? organizationSettingsMessages.bannerPreviewAlt : organizationSettingsMessages.logoPreviewAlt)}
            label={formatMessage(isBanner ? organizationSettingsMessages.chooseBanner : organizationSettingsMessages.chooseLogo)}
            prompt={(
              <FormattedMessage
                {...organizationSettingsMessages.dropPrompt}
                values={{
                  strong: chunks => (
                    <strong>
                      {chunks}
                    </strong>
                  ),
                }}
              />
            )}
            accept={ORGANIZATION_IMAGE_CONTENT_TYPES.join(',')}
            onFileSelect={selectFile}
          />
          {error
            ? (
                <p
                  role="alert"
                  className="m-0 text-center text-xs text-danger"
                >
                  {error}
                </p>
              )
            : null}
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
          {src
            ? (
                <Button
                  variant="danger"
                  size="sm"
                  confirm={formatMessage(organizationSettingsMessages.removeConfirm)}
                  onClick={remove}
                  className="sm:mr-auto"
                >
                  {formatMessage(organizationSettingsMessages.remove)}
                </Button>
              )
            : null}
          <Button
            variant="transparent"
            onClick={onClose}
          >
            {formatMessage(organizationSettingsMessages.cancel)}
          </Button>
          <Button
            disabled={!isChanged}
            onClick={apply}
          >
            {formatMessage(organizationSettingsMessages.apply)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OrganizationSettingsImageDialog
