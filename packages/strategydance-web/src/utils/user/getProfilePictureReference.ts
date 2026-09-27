import { ref } from 'firebase/storage'

import { storage } from '~data/firebase'

/*
  Where somebody's profile picture lives: one fixed object per account, which `storage.rules` lets
  its owner write and delete, and anybody read. Replacing the picture overwrites it, so the bucket
  holds one per account however often it changes
*/
function getProfilePictureReference(userId: string) {
  return ref(storage, `users/${userId}/profile-picture`)
}

export default getProfilePictureReference
