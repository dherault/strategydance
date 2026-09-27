import { FirebaseError } from 'firebase/app'
import { deleteObject } from 'firebase/storage'

import getProfilePictureReference from '~utils/user/getProfilePictureReference'

/*
  Takes the account's profile picture off the bucket. A picture that was never uploaded, like the
  one a Google account arrives with, which Google hosts, leaves nothing to delete, and that is the
  outcome asked for rather than a failure
*/
async function deleteProfilePicture(userId: string) {
  try {
    await deleteObject(getProfilePictureReference(userId))
  }
  catch (error) {
    if (error instanceof FirebaseError && error.code === 'storage/object-not-found') return

    throw error
  }
}

export default deleteProfilePicture
