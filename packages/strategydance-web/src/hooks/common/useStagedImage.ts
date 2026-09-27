import { useEffect, useState } from 'react'

import type { StagedImage } from '~types'

/*
  A picture chosen but not saved yet, with the object URL that previews it.

  The URL is made where the picture is staged, in an event, and revoked by the effect once the
  picture it previews is replaced or the component goes, so a page choosing ten pictures holds
  one. A URL belongs to whoever staged it: handing the blob to somebody else means they stage
  their own, or this one's cleanup would revoke it from under them
*/
function useStagedImage() {
  const [staged, setStaged] = useState<StagedImage>(undefined)

  useEffect(() => {
    if (!staged) return

    const { url } = staged

    return () => URL.revokeObjectURL(url)
  }, [staged])

  // A blob to preview and save, or null for the picture there to be removed
  function stage(blob: Blob | null) {
    setStaged(blob ? { blob, url: URL.createObjectURL(blob) } : null)
  }

  // Back to nothing chosen
  function unstage() {
    setStaged(undefined)
  }

  return { staged, stage, unstage }
}

export default useStagedImage
