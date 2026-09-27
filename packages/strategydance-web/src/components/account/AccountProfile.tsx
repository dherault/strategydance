import { PencilIcon, UploadIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useIntl } from 'react-intl'
import { MAX_USER_BIO_LENGTH, MAX_USER_NAME_LENGTH } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Field } from 'strategydance-design-system/components/ui/Field'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { cn } from 'strategydance-design-system/lib/utils'

import type { User } from '~types'

import useStagedImage from '~hooks/common/useStagedImage'
import useUser from '~hooks/user/useUser'

import AccountProfilePhoto from '~components/account/AccountProfilePhoto'
import AccountProfilePictureDialog from '~components/account/AccountProfilePictureDialog'
import AccountProfilePreview from '~components/account/AccountProfilePreview'
import Spinner from '~components/common/Spinner'

import accountMessages from '~data/intl/messages/account'

// How close to the bio's limit the counter turns amber
const BIO_COUNT_WARNING = 20

type Props = {
  user: User
}

/*
  The reader's name, picture and bio, beside a preview of how their team sees them: one card, one
  form, saved or discarded together.

  The form starts from the row and is compared to it on every render, so it reads as changed or
  not without an effect, and as saved the moment the row shows what was sent. A picture chosen in
  its dialog waits on the card, previewed, until the form is saved, as an organization's logo does
  on its settings page
*/
function AccountProfile({ user }: Props) {
  const { formatMessage } = useIntl()
  const { updateProfile } = useUser()
  const { staged: stagedPicture, stage: stagePicture, unstage: unstagePicture } = useStagedImage()

  const savedName = user.displayName ?? ''
  const savedBio = user.bio ?? ''

  const [name, setName] = useState(savedName)
  const [bio, setBio] = useState(savedBio)
  // Makes the fields read-only while a save is in flight, since a success puts what was sent back
  // in them: anything typed meanwhile would be lost
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingPicture, setIsEditingPicture] = useState(false)

  const trimmedName = name.trim()
  const trimmedBio = bio.trim()
  const isPictureChanged = stagedPicture !== undefined
  // Anything to discard, spaces included
  const isDirty = name !== savedName || bio !== savedBio || isPictureChanged
  /*
    Anything to save, which spaces alone are not. Only once something was touched: a name mirrored
    from Google as it came, spaces at an end included, differs from its trimmed self on arrival
  */
  const canSave = isDirty && (trimmedName !== savedName || trimmedBio !== savedBio || isPictureChanged) && !!trimmedName && !isSaving
  // Only once the reader has emptied it: an account that never had a name is not told off on arrival
  const isNameMissing = !trimmedName && name !== savedName

  // What the card shows: a picture chosen and not saved yet, or else the saved one
  const pictureSrc = stagedPicture === undefined ? user.imageUrl ?? null : stagedPicture?.url ?? null
  const pictureLabel = formatMessage(pictureSrc ? accountMessages.changePicture : accountMessages.uploadPicture)

  /*
    Stages what the dialog applied. Removing a picture that is not saved, only chosen, is going back
    to nothing chosen rather than a removal to send
  */
  function applyPicture(image: Blob | null) {
    if (image || user.imageUrl) stagePicture(image)
    else unstagePicture()
  }

  function discardChanges() {
    setName(savedName)
    setBio(savedBio)
    unstagePicture()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) return

    setIsSaving(true)

    try {
      await updateProfile({
        displayName: trimmedName,
        image: stagedPicture === undefined ? undefined : stagedPicture?.blob ?? null,
        bio: trimmedBio || null,
      })

      // What was saved, without the spaces the server was never sent
      setName(trimmedName)
      setBio(trimmedBio)
      unstagePicture()

      toast.success(formatMessage(accountMessages.saved))
    }
    catch (error) {
      console.error('Failed to save the profile', error)

      // What was not saved stays where it was chosen or typed
      toast.error(formatMessage(accountMessages.saveError))
    }
    finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-xs border border-border bg-white"
      >
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <AccountProfilePreview
            name={trimmedName}
            bio={trimmedBio}
          >
            <AccountProfilePhoto
              src={pictureSrc}
              // An emptied field keeps the saved name's initials, or the address's, rather than none
              name={trimmedName || savedName || user.email}
              label={pictureLabel}
              disabled={isSaving}
              onClick={() => setIsEditingPicture(true)}
            />
          </AccountProfilePreview>
          <div className="flex flex-col gap-7 p-5 md:p-8">
            <Field label={formatMessage(accountMessages.pictureLabel)}>
              <Button
                variant="secondary"
                size="sm"
                icon={pictureSrc ? <PencilIcon /> : <UploadIcon />}
                disabled={isSaving}
                onClick={() => setIsEditingPicture(true)}
                className="self-start"
              >
                {pictureLabel}
              </Button>
            </Field>
            <Input
              label={formatMessage(accountMessages.nameLabel)}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={formatMessage(accountMessages.namePlaceholder)}
              maxLength={MAX_USER_NAME_LENGTH}
              autoComplete="name"
              required
              readOnly={isSaving}
              error={isNameMissing ? formatMessage(accountMessages.nameRequired) : undefined}
            />
            <Textarea
              label={formatMessage(accountMessages.bioLabel)}
              value={bio}
              onChange={event => setBio(event.target.value)}
              placeholder={formatMessage(accountMessages.bioPlaceholder)}
              maxLength={MAX_USER_BIO_LENGTH}
              rows={4}
              readOnly={isSaving}
              hint={(
                <span className="flex justify-between gap-3">
                  <span>
                    {formatMessage(accountMessages.bioHint)}
                  </span>
                  <span className={cn('flex-none tabular-nums', MAX_USER_BIO_LENGTH - bio.length <= BIO_COUNT_WARNING && 'text-warning')}>
                    {formatMessage(accountMessages.bioCount, { count: bio.length, max: MAX_USER_BIO_LENGTH })}
                  </span>
                </span>
              )}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4 md:px-8">
          <Button
            variant="transparent"
            disabled={!isDirty || isSaving}
            onClick={discardChanges}
          >
            {formatMessage(accountMessages.cancel)}
          </Button>
          <Button
            type="submit"
            disabled={!canSave}
            icon={isSaving ? <Spinner tone="current" /> : undefined}
          >
            {formatMessage(accountMessages.save)}
          </Button>
        </div>
      </form>
      {isEditingPicture
        ? (
            <AccountProfilePictureDialog
              currentSrc={pictureSrc}
              onApply={applyPicture}
              onClose={() => setIsEditingPicture(false)}
            />
          )
        : null}
    </>
  )
}

export default AccountProfile
