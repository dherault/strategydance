/*
  A UUID as Data Connect writes one: 32 lowercase hex digits, no hyphens. It reads either form, so
  a route may be called with either, but a Storage path built from an id has to come out the same
  whichever the caller sent, or deleting an organization would sweep one prefix and leave the other
*/
function toCanonicalUuid(uuid: string) {
  return uuid.replaceAll('-', '').toLowerCase()
}

export default toCanonicalUuid
