/*
  A fresh id for a row the page inserts itself, so it can show the row before the server answers
  and point at it after. A UUID written as Data Connect writes one back, 32 hex digits and no
  dashes: an id the page made must read the same once it returns from the server, or the row it
  names looks like another one
*/
function createId() {
  return crypto.randomUUID().replaceAll('-', '')
}

export default createId
