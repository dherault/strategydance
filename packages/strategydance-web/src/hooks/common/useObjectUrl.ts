import { useSyncExternalStore } from 'react'

import { holdObjectUrl, readObjectUrl } from '~data/objectUrls'

/*
  An address an `<img>` can draw a blob from, for as long as the blob is drawn: held while the
  component shows it, and given back to the browser once nothing does, so its bytes are not kept
  for the life of the tab. Null until the component has mounted, for no blob, and while the
  document shell is prerendered
*/
function useObjectUrl(blob: Blob | null) {
  return useSyncExternalStore(
    () => (blob ? holdObjectUrl(blob) : () => {}),
    () => (blob ? readObjectUrl(blob) : null),
    () => null,
  )
}

export default useObjectUrl
