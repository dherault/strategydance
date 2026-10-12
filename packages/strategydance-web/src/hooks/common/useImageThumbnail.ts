import { useQuery } from '@tanstack/react-query'

import createImageThumbnail from '~utils/common/createImageThumbnail'
import runInOrder from '~utils/common/runInOrder'

/*
  A small copy of an image, fitted inside a square of `size` pixels, for where it is drawn small:
  an `<img>` decodes its picture whole whatever size it is drawn at, so twenty large images drawn
  as thumbnails from their own bytes could take a tab's memory. Drawn one at a time across the tab,
  since each drawing decodes the image whole for a moment, and kept under `key`, which names the
  image. Undefined while it is drawn, and null when the browser could not draw it
*/
function useImageThumbnail(key: readonly unknown[], image: Blob | null, size: number) {
  const { data } = useQuery({
    queryKey: ['ImageThumbnail', size, ...key],
    queryFn: () => runInOrder('imageThumbnails', () => createImageThumbnail(image!, size)),
    enabled: image !== null,
    staleTime: Infinity,
  })

  return data
}

export default useImageThumbnail
