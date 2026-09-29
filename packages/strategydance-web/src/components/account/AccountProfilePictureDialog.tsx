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
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import { MAX_PROFILE_PICTURE_SIZE, PROFILE_PICTURE_CONTENT_TYPES } from '~constants'

import useStagedImage from '~hooks/common/useStagedImage'
import useUser from '~hooks/user/useUser'

import accountMessages from '~data/intl/messages/account'

// What the picture should measure, as the dialog advises. Advice only: nothing refuses a smaller
// picture, since the avatar crops whatever it is given to a circle, as the dialog previews it
const MINIMUM_SIZE = { width: 256, height: 256 }

const MAXIMUM_MEGABYTES = MAX_PROFILE_PICTURE_SIZE / (1024 * 1024)

type Props = {
  // The picture saved now, if any
  currentSrc: string | null
  onClose: () => void
}

/*
  Chooses the reader's profile picture, or removes it, and saves that at once, apart from the
  account page's form, as an organization's logo is on its company profile. Mounted only while
  open, so it starts from what is saved every time.

  A picture chosen shows in the zone while it is saved, and the dialog stays open until the save
  lands and cannot be dismissed meanwhile. A failure puts the saved picture back, for another try.
  The type and size are checked here, before anything is sent, and the Storage rule checks both
  again
*/
function AccountProfilePictureDialog({ currentSrc, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { changePicture } = useUser()
  const { staged: choice, stage, unstage } = useStagedImage()

  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // The picture being saved, or else the saved one
  const src = choice ? choice.url : currentSrc

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
    save(file)
  }

  function remove() {
    setError(null)
    save(null)
  }

  /*
    Saves a picture, or null to remove the one there, and closes once the row shows the change,
    which is when the card does. Handed the file rather than the preview's URL, which this dialog
    revokes as it closes
  */
  async function save(image: Blob | null) {
    if (isSaving) return

    setIsSaving(true)

    try {
      await changePicture(image)
    } catch (saveError) {
      console.error('Failed to save the profile picture', saveError)

      toast.error(formatMessage(accountMessages.pictureSaveError))
      unstage()
      setIsSaving(false)

      return
    }

    toast.success(formatMessage(image ? accountMessages.pictureSaved : accountMessages.pictureRemoved))
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && !isSaving && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(accountMessages.closeDialog)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>
            {formatMessage(currentSrc ? accountMessages.changePicture : accountMessages.uploadPicture)}
          </DialogTitle>
          <DialogDescription>{formatMessage(accountMessages.pictureDialogDescription)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <ImageDropzone
            shape="circle"
            src={src}
            alt={formatMessage(accountMessages.picturePreviewAlt)}
            label={formatMessage(accountMessages.choosePicture)}
            prompt={
              <FormattedMessage
                {...accountMessages.pictureDropPrompt}
                values={{
                  strong: chunks => <strong>{chunks}</strong>,
                }}
              />
            }
            accept={PROFILE_PICTURE_CONTENT_TYPES.join(',')}
            onFileSelect={selectFile}
            busy={isSaving}
            busyLabel={formatMessage(accountMessages.pictureSaving)}
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
          {currentSrc ? (
            <Button
              variant="danger"
              size="sm"
              confirm={formatMessage(accountMessages.removePictureConfirm)}
              disabled={isSaving}
              onClick={remove}
              className="sm:mr-auto"
            >
              {formatMessage(accountMessages.removePicture)}
            </Button>
          ) : null}
          <Button
            variant="transparent"
            disabled={isSaving}
            onClick={onClose}
          >
            {formatMessage(accountMessages.cancel)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AccountProfilePictureDialog
