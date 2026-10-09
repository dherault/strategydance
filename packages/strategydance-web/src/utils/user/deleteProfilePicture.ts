import deleteStoredFile from '~utils/common/deleteStoredFile'
import getProfilePictureReference from '~utils/user/getProfilePictureReference'
import getProfilePictureThumbnailReference from '~utils/user/getProfilePictureThumbnailReference'

/*
  Takes the account's profile picture and its thumbnail off the bucket. A picture that was never
  uploaded, like the one a Google account arrives with, which Google hosts, leaves nothing to
  delete, and neither does a picture from before thumbnails leave a thumbnail
*/
async function deleteProfilePicture(userId: string) {
  await Promise.all([
    deleteStoredFile(getProfilePictureReference(userId)),
    deleteStoredFile(getProfilePictureThumbnailReference(userId)),
  ])
}

export default deleteProfilePicture
