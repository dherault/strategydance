type BuildStorageDownloadUrlInput = {
  // `STORAGE_DOWNLOAD_ORIGIN`: the emulator's in development, Firebase's download host otherwise
  origin: string
  bucket: string
  name: string
  // The `firebaseStorageDownloadTokens` the object was saved with
  token: string
}

/*
  The URL a browser downloads an object from, in the shape the Admin SDK's `getDownloadURL`
  writes. Built here rather than asked for, because asking reads the object's metadata through
  the download host, which the emulator answers only as the rules allow, and they allow nothing
  under `organizations/`. The token is what lets a reader in without them
*/
function buildStorageDownloadUrl({ origin, bucket, name, token }: BuildStorageDownloadUrlInput) {
  return `${origin}/v0/b/${bucket}/o/${encodeURIComponent(name)}?alt=media&token=${encodeURIComponent(token)}`
}

export default buildStorageDownloadUrl
