import { decodeHTML } from 'entities'
import type { LinkPreviewData } from 'strategydance-core'

// Longer than any page's own, and short enough for a card
const MAX_TITLE_LENGTH = 300
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_SITE_NAME_LENGTH = 100

/*
  What the start of a web page says of itself, from its Open Graph and Twitter tags, its `<title>`
  and its description: its title, its description, its site's name, and its picture, as an https
  address resolved against the page's own, which is the only kind a card loads. The first tag of
  each name counts. Text is decoded, its spaces folded and its length held to a card's; whatever
  the page names none of is left out
*/
async function parseLinkPreviewHtml(html: string, pageUrl: string): Promise<Omit<LinkPreviewData, 'url'>> {
  const tags = new Map<string, string>()
  let documentTitle = ''

  await new HTMLRewriter()
    .on('meta', {
      element: element => {
        const name = (element.getAttribute('property') ?? element.getAttribute('name') ?? '').trim().toLowerCase()
        const content = element.getAttribute('content')

        if (name && content && !tags.has(name)) tags.set(name, content)
      },
    })
    // The head's, never an icon's that an SVG in the body titles
    .on('head title', {
      text: chunk => {
        documentTitle += chunk.text
      },
    })
    .transform(new Response(html))
    .text()

  const title = readText(tags.get('og:title') ?? tags.get('twitter:title') ?? documentTitle, MAX_TITLE_LENGTH)
  const description = readText(
    tags.get('og:description') ?? tags.get('twitter:description') ?? tags.get('description'),
    MAX_DESCRIPTION_LENGTH,
  )
  const siteName = readText(tags.get('og:site_name') ?? tags.get('application-name'), MAX_SITE_NAME_LENGTH)
  const imageUrl = readImageUrl(
    tags.get('og:image:secure_url')
      ?? tags.get('og:image')
      ?? tags.get('twitter:image')
      ?? tags.get('twitter:image:src'),
    pageUrl,
  )

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(siteName ? { siteName } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  }
}

function readText(value: string | undefined, maxLength: number) {
  if (!value) return ''

  const text = decodeHTML(value).replace(/\s+/g, ' ').trim()

  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
}

// A picture's address, resolved against the page's, when it is an https one
function readImageUrl(value: string | undefined, pageUrl: string) {
  if (!value) return null

  try {
    const url = new URL(decodeHTML(value).trim(), pageUrl)

    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export default parseLinkPreviewHtml
