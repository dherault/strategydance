import { getDownloadURL, uploadBytes } from 'firebase/storage'

import getProfilePictureReference from '~utils/user/getProfilePictureReference'

/*
  Puts a picture at the account's profile picture, over the one there, and answers with its
  download URL. The content type is sent with it because the rule checks it: a blob that carried
  none would be refused
*/
async function uploadProfilePicture(userId: string, image: Blob) {
  const { ref } = await uploadBytes(getProfilePictureReference(userId), image, { contentType: image.type })

  return getDownloadURL(ref)
}

export default uploadProfilePicture
