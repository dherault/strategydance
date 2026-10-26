import createConcurrencyLimit from '~utils/createConcurrencyLimit'

/*
  The files each instance reads back from Storage at once, after an upload, to check them, a
  conversation's and a bill's receipt alike, so its memory stays bounded however many uploads arrive
  together: one, and the heap collected whole after each. Bun collects the buffers a read-back leaves
  late, so they pile up across files rather than files at once: twenty files of 10 MiB uploaded
  together took one backend past Cloud Run's 512 MiB two at a time without collecting, and to 434 MiB
  one at a time with (`load:conversation-attachments`, with the requests the real client sends
  simulated). A full collection takes milliseconds, which an upload of megabytes does not notice
*/
const readBackLimit = createConcurrencyLimit(1)

// Runs what reads an uploaded file back, once no other read-back runs, and collects the heap after
function runUploadReadBack<T>(readBack: () => Promise<T>) {
  return readBackLimit(async () => {
    try {
      return await readBack()
    } finally {
      Bun.gc(true)
    }
  })
}

export default runUploadReadBack
