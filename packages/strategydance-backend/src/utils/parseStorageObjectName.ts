/*
  The name of the object a download URL points at in `bucket`, or null when it points anywhere
  else or is not a download URL at all. The inverse of `buildStorageDownloadUrl`, whatever its
  origin, so a URL written in development still reads in development after the port moves
*/
function parseStorageObjectName(url: string, bucket: string) {
  let pathname: string

  try {
    ({ pathname } = new URL(url))
  }
  catch {
    return null
  }

  const prefix = `/v0/b/${bucket}/o/`

  if (!pathname.startsWith(prefix)) return null

  const encodedName = pathname.slice(prefix.length)

  if (!encodedName || encodedName.includes('/')) return null

  try {
    return decodeURIComponent(encodedName)
  }
  catch {
    return null
  }
}

export default parseStorageObjectName
