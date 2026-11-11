import { randomUUID } from 'node:crypto'

/*
  A fresh id for a row or an object the backend makes, a UUID written as Data Connect writes one, 32
  lowercase hex digits and no hyphens, so it reads the same once it comes back from the database
*/
function createId() {
  return randomUUID().replaceAll('-', '')
}

export default createId
