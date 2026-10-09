import { ref } from 'firebase/storage'

import { storage } from '~data/firebase'

/*
  Where somebody's profile picture's thumbnail lives: one fixed object per account beside the
  picture, on the same terms in `storage.rules`, overwritten with it
*/
function getProfilePictureThumbnailReference(userId: string) {
  return ref(storage, `users/${userId}/profile-picture-thumbnail`)
}

export default getProfilePictureThumbnailReference
