import { FirebaseError } from 'firebase/app'
import { type StorageReference, deleteObject } from 'firebase/storage'

/*
  Takes a file off the bucket. One that is not there, as one never uploaded, leaves nothing to
  delete, and that is the outcome asked for rather than a failure
*/
async function deleteStoredFile(reference: StorageReference) {
  try {
    await deleteObject(reference)
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'storage/object-not-found') return

    throw error
  }
}

export default deleteStoredFile
