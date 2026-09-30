import { getInitials } from 'strategydance-design-system/lib/getInitials'

// Twice the card's CSS size, so a 600px wide card is a 1200px wide picture, sharp on any screen
const PIXEL_RATIO = 2

/*
  The page's font faces with each font file inlined, read once for every card. Read off the whole
  page, where every card is mounted, since the library inlines only the families of the element it
  is handed: read off one card, it would leave out the display face for every later card whenever
  the first had none
*/
let fontEmbedCss: Promise<string> | null = null

// Each picture a card has shown, as a data URL, or null when it could not be fetched
const imageDataUrls = new Map<string, Promise<string | null>>()

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/*
  A picture's bytes, which the image is drawn from, since a canvas refuses a picture from another
  origin that it did not read itself. Storage answers only the origins `storage.cors.json` lists,
  so anywhere else this is null, as it is for a picture that is gone
*/
function fetchImage(src: string) {
  let dataUrl = imageDataUrls.get(src)

  if (!dataUrl) {
    dataUrl = fetch(src, { mode: 'cors' })
      .then(response => {
        if (!response.ok) throw new Error(`Could not fetch a picture: ${response.status}`)

        return response.blob()
      })
      .then(readAsDataUrl)
      .catch((error: unknown) => {
        console.warn('Drawing a card without one of its pictures', error)

        // The next picture asked for tries again, rather than a blip lasting until the page reloads
        imageDataUrls.delete(src)

        return null
      })

    imageDataUrls.set(src, dataUrl)
  }

  return dataUrl
}

// Somebody's initials on the colors of the design system's avatar, for a picture of them that
// could not be fetched, drawn at the size the picture had
function drawInitials(name: string, size: number) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const styles = getComputedStyle(document.documentElement)

  canvas.width = canvas.height = Math.max(64, size * PIXEL_RATIO)

  if (!context) return null

  context.fillStyle = styles.getPropertyValue('--color-secondary-100').trim() || '#dbe4ee'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = styles.getPropertyValue('--color-secondary').trim() || '#142a41'
  context.font = `600 ${Math.round(canvas.width * 0.4)}px "Inter Variable", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(getInitials(name), canvas.width / 2, canvas.height / 2 + 1)

  return canvas.toDataURL()
}

// Keeps the font faces of the families a card uses, so its picture does not carry every face
// the page loaded
function keepUsedFontFaces(css: string, element: HTMLElement) {
  const families = new Set<string>()

  for (const node of [element, ...element.querySelectorAll('*')]) {
    for (const family of getComputedStyle(node).fontFamily.split(',')) {
      families.add(family.trim().replace(/["']/g, '').toLowerCase())
    }
  }

  return (css.match(/@font-face\s*{[^}]*}/g) ?? [])
    .filter(rule => {
      const match = /font-family:\s*["']?([^;"']+)/i.exec(rule)

      return match ? families.has(match[1].trim().toLowerCase()) : false
    })
    .join('\n')
}

/*
  A card as a PNG, twice its size, with the page's fonts and the card's pictures in it.

  Each picture is swapped for its bytes while the card is drawn, then put back. One that cannot be
  fetched becomes its subject's initials when it names somebody, as an avatar does, and is left out
  otherwise, so what it covered shows: a logo's initials, a banner's color. When drawing still
  fails, the card is drawn once more without any picture
*/
async function renderCardImage(element: HTMLElement) {
  // Imported here rather than at the top, so the library loads with the first picture asked for,
  // and never in the document shell prerendered at build time
  const { getFontEmbedCSS, toBlob } = await import('html-to-image')

  await document.fonts.ready

  fontEmbedCss ??= getFontEmbedCSS(document.body).catch((error: unknown) => {
    console.warn("Drawing a card without the page's fonts", error)

    // The next card tries again, rather than every card going without them until the page reloads
    fontEmbedCss = null

    return ''
  })

  const fontCss = keepUsedFontFaces(await fontEmbedCss, element)
  const images = [...element.querySelectorAll('img')].filter(image => image.src && !image.src.startsWith('data:'))
  const swaps = await Promise.all(
    images.map(async image => {
      const src = image.src
      const dataUrl = (await fetchImage(src)) ?? (image.alt ? drawInitials(image.alt, image.clientWidth) : null)

      return { image, src, dataUrl }
    }),
  )
  const leftOut = new Set<Node>(swaps.filter(swap => !swap.dataUrl).map(swap => swap.image))

  for (const swap of swaps) {
    if (swap.dataUrl) swap.image.src = swap.dataUrl
  }

  try {
    await Promise.all(swaps.map(swap => swap.image.decode().catch(() => undefined)))

    const options = {
      pixelRatio: PIXEL_RATIO,
      fontEmbedCSS: fontCss,
      cacheBust: false,
      filter: (node: HTMLElement) => !leftOut.has(node),
    }
    const blob = await toBlob(element, options).catch(() =>
      toBlob(element, { ...options, filter: (node: HTMLElement) => node.tagName !== 'IMG' }),
    )

    if (!blob) throw new Error('Could not draw the card')

    return blob
  } finally {
    for (const swap of swaps) swap.image.src = swap.src
  }
}

export default renderCardImage
