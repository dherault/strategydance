import { MAX_MIRRORED_USER_NAME_LENGTH } from 'strategydance-core'

/*
  The account's name as its row mirrors it: cut to the longest a mirror writes, by code points as
  the mutations' checks count them, so a name too long from Google costs its end rather than the
  account its row
*/
function toMirroredUserName(name: string | null) {
  if (name === null) return null

  const codePoints = Array.from(name)

  return codePoints.length > MAX_MIRRORED_USER_NAME_LENGTH
    ? codePoints.slice(0, MAX_MIRRORED_USER_NAME_LENGTH).join('')
    : name
}

export default toMirroredUserName
