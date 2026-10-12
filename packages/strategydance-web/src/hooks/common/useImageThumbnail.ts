import { useQuery } from '@tanstack/react-query'

import createImageThumbnail from '~utils/common/createImageThumbnail'
import runImageDrawing from '~utils/common/runImageDrawing'

/*
  A small copy of an image, fitted inside a square of `size` pixels, for where it is drawn small:
  an `<img>` decodes its picture whole whatever size it is drawn at, so twenty large images drawn
  as thumbnails from their own bytes could take a tab's memory. Drawn one at a time across the tab,
  with every other drawing of an image (`runImageDrawing`), and kept under `key`, which names the
  image. One whose reader has gone by its turn, its query cancelled, is never drawn. Undefined while
  it is drawn, and null when the browser could not draw it
*/
function useImageThumbnail(key: readonly unknown[], image: Blob | null, size: number) {
  const { data } = useQuery({
    queryKey: ['ImageThumbnail', size, ...key],
    queryFn: ({ signal }) =>
      runImageDrawing(async () => {
        signal.throwIfAborted()

        return createImageThumbnail(image!, size)
      }),
    enabled: image !== null,
    staleTime: Infinity,
  })

  return data
}

export default useImageThumbnail
