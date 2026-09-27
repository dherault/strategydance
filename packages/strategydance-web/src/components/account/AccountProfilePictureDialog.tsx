import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
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

import { MAX_PROFILE_PICTURE_SIZE, PROFILE_PICTURE_CONTENT_TYPES } from '~constants'

import useStagedImage from '~hooks/common/useStagedImage'

import accountMessages from '~data/intl/messages/account'

// What the picture should measure, as the dialog advises. Advice only: nothing refuses a smaller
// picture, since the avatar crops whatever it is given to a circle, as the dialog previews it
const MINIMUM_SIZE = { width: 256, height: 256 }

const MAXIMUM_MEGABYTES = MAX_PROFILE_PICTURE_SIZE / (1024 * 1024)

type Props = {
  // What the card shows now, whether saved or chosen earlier and not saved yet
  currentSrc: string | null
  // A picture to put on the card, or null to take the one there away. Saving is the card's
  onApply: (image: Blob | null) => void
  onClose: () => void
}

/*
  Chooses the reader's profile picture, or removes it, as an organization's logo is chosen on its
  settings page. Mounted only while open, so it starts from what the card shows every time.

  Applying puts the choice on the card and nothing more: the card saves it with the rest of its
  changes. The type and size are checked here, before anything is sent, and the Storage rule
  checks both again
*/
function AccountProfilePictureDialog({ currentSrc, onApply, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { staged: choice, stage } = useStagedImage()

  const [error, setError] = useState<string | null>(null)

  const src = choice === undefined ? currentSrc : choice?.url ?? null
  // Removing a picture that was never there changes nothing
  const isChanged = choice !== undefined && (choice !== null || currentSrc !== null)

  const specs = [
    formatMessage(accountMessages.pictureSquare),
    formatMessage(accountMessages.pictureMinimumSize, MINIMUM_SIZE),
    formatMessage(accountMessages.pictureMaximumSize, { megabytes: MAXIMUM_MEGABYTES }),
  ]

  function selectFile(file: File) {
    if (!PROFILE_PICTURE_CONTENT_TYPES.includes(file.type)) {
      setError(formatMessage(accountMessages.pictureTypeError))

      return
    }

    if (file.size > MAX_PROFILE_PICTURE_SIZE) {
      setError(formatMessage(accountMessages.pictureSizeError, { megabytes: MAXIMUM_MEGABYTES }))

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

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(accountMessages.closeDialog)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>
            {formatMessage(currentSrc ? accountMessages.changePicture : accountMessages.uploadPicture)}
          </DialogTitle>
          <DialogDescription>
            {formatMessage(accountMessages.pictureDialogDescription)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <ImageDropzone
            shape="circle"
            src={src}
            alt={formatMessage(accountMessages.picturePreviewAlt)}
            label={formatMessage(accountMessages.choosePicture)}
            prompt={(
              <FormattedMessage
                {...accountMessages.pictureDropPrompt}
                values={{
                  strong: chunks => (
                    <strong>
                      {chunks}
                    </strong>
                  ),
                }}
              />
            )}
            accept={PROFILE_PICTURE_CONTENT_TYPES.join(',')}
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
                  confirm={formatMessage(accountMessages.removePictureConfirm)}
                  onClick={remove}
                  className="sm:mr-auto"
                >
                  {formatMessage(accountMessages.removePicture)}
                </Button>
              )
            : null}
          <Button
            variant="transparent"
            onClick={onClose}
          >
            {formatMessage(accountMessages.cancel)}
          </Button>
          <Button
            disabled={!isChanged}
            onClick={apply}
          >
            {formatMessage(accountMessages.applyPicture)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AccountProfilePictureDialog
