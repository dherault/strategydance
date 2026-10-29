import { gzipSync } from 'node:zlib'

/*
  A document's snapshot as a revision keeps it: the Yjs update compressed with gzip, in base64. A
  fold sends the revision beside the new snapshot, and Data Connect takes 4 MiB a request, which two
  whole snapshots can pass; text compresses well, and a month of revisions takes less room
*/
function compressDocumentRevisionState(state: string) {
  return gzipSync(Buffer.from(state, 'base64')).toString('base64')
}

export default compressDocumentRevisionState
