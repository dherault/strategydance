type Size = {
  width: number
  height: number
}

/*
  What a picture measures once fitted inside a square of `maxSize` pixels: its longer side brought
  down to `maxSize`, its proportions kept, and a picture smaller already left at its size, since
  enlarging it would only blur it into more bytes. Never under a pixel, however thin the picture
*/
function getThumbnailSize({ width, height }: Size, maxSize: number): Size {
  const scale = Math.min(1, maxSize / Math.max(width, height))

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export default getThumbnailSize
