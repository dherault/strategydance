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
  Puts a picture at the account's profile picture, over the one there, with the thumbnail drawn of
  it beside it, and answers with both download URLs.

  A thumbnail the browser could not draw is null, and the one there is deleted rather than left
  public showing the picture this one replaces. The row then has no thumbnail, and the picture is
  drawn in its place
*/
async function uploadProfilePicture(userId: string, image: Blob) {
  const thumbnail = await createImageThumbnail(image)
  const thumbnailReference = getProfilePictureThumbnailReference(userId)

  const [imageUrl, imageThumbnailUrl] = await Promise.all([
    uploadFile(getProfilePictureReference(userId), image),
    thumbnail ? uploadFile(thumbnailReference, thumbnail) : deleteStoredFile(thumbnailReference).then(() => null),
  ])

  return { imageUrl, imageThumbnailUrl }
}

export default uploadProfilePicture
