import { MAX_DOCUMENT_WRITE_REQUEST_BYTES } from '~constants'

/*
  Whether a write of a document's text would pass what Data Connect takes in one request, its
  variables as the Admin SDK sends them, JSON in UTF-8: a fold carrying its revision beside the new
  snapshot, both near their bounds, can. Refused rather than sent, since Data Connect would refuse
  it all the same, and rather than written without its revision, which is what guards the text
*/
function isDocumentWriteTooLarge(variables: object) {
  return Buffer.byteLength(JSON.stringify(variables)) > MAX_DOCUMENT_WRITE_REQUEST_BYTES
}

export default isDocumentWriteTooLarge
