import { type StorageReference, getDownloadURL, uploadBytes } from 'firebase/storage'

import createImageThumbnail from '~utils/common/createImageThumbnail'
import deleteStoredFile from '~utils/common/deleteStoredFile'
import getProfilePictureReference from '~utils/user/getProfilePictureReference'
import getProfilePictureThumbnailReference from '~utils/user/getProfilePictureThumbnailReference'

/*
  Puts a file at a reference, over the one there, and answers with its download URL. The content
  type is sent with it because the rule checks it: a blob that carried none would be refused
*/
async function uploadFile(reference: StorageReference, file: Blob) {
  const { ref } = await uploadBytes(reference, file, { contentType: file.type })

  return getDownloadURL(ref)
}

/*
  Puts the thumbnail at the account's, over the one there, and answers with its download URL, or
  null when there is none to put or it fails to go up. The one there is then deleted rather than
  left public showing the picture this one replaces, as far as it can be: the row is written
  either way, without a thumbnail, and the picture is drawn in its place
*/
async function uploadProfilePictureThumbnail(userId: string, thumbnail: Blob | null) {
  const reference = getProfilePictureThumbnailReference(userId)

  try {
    if (thumbnail) return await uploadFile(reference, thumbnail)
  } catch (error) {
    console.error("Failed to upload the profile picture's thumbnail", error)
  }

  try {
    await deleteStoredFile(reference)
  } catch (error) {
    console.error("Failed to delete the previous profile picture's thumbnail", error)
  }

  return null
}

/*
  Puts a picture at the account's profile picture, over the one there, with the thumbnail drawn of
  it beside it, and answers with both download URLs.

  The picture goes first, and only a failure there throws, which leaves the account as it was. The
  thumbnail follows, and cannot fail the change once the picture is replaced: the row has to follow
  the picture whatever becomes of its thumbnail
*/
async function uploadProfilePicture(userId: string, image: Blob) {
  const thumbnail = await createImageThumbnail(image)
  const imageUrl = await uploadFile(getProfilePictureReference(userId), image)
  const imageThumbnailUrl = await uploadProfilePictureThumbnail(userId, thumbnail)

  return { imageUrl, imageThumbnailUrl }
}

export default uploadProfilePicture
