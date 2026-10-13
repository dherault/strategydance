import { decodeHTML } from 'entities'

import { DIRECTORY_PAGE_MAX_LINKS, DIRECTORY_PAGE_MAX_TEXT_LENGTH } from '~domain/directories/directoryCheckSettings'
import toSiteHost from '~domain/directories/toSiteHost'

// What no reader sees: scripts, styles and the rest a browser does not draw as text
const HIDDEN_ELEMENTS = 'head, script, style, noscript, template, svg, iframe, object'

// What a link to a picture, a stylesheet or a script ends with, which no review reads
const ASSET_PATTERN = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|woff2?|ttf|xml|json|zip|mp4)$/i

/*
  What a page shows a reader: its title, its description, and its text as a reader sees it, the
  text of its scripts, styles and head left out, decoded, its spaces folded and held to what a
  review quotes. And the pages of the same site it links to, resolved against its address: web
  fetch only fetches an address the conversation holds, so a review reaches a site's FAQ or pricing
  through these
*/
async function readDirectoryPage(html: string, pageUrl: string) {
  const tags = new Map<string, string>()
  const chunks: string[] = []
  const links = new Set<string>()
  const siteHost = toSiteHost(pageUrl)
  let title = ''
  let hiddenDepth = 0

  await new HTMLRewriter()
    .on('meta', {
      element: element => {
        const name = (element.getAttribute('property') ?? element.getAttribute('name') ?? '').trim().toLowerCase()
        const content = element.getAttribute('content')

        if (name && content && !tags.has(name)) tags.set(name, content)
      },
    })
    .on('a[href]', {
      element: element => {
        const link = readLink(element.getAttribute('href'), pageUrl, siteHost)

        if (link && links.size < DIRECTORY_PAGE_MAX_LINKS) links.add(link)
      },
    })
    .on('head title', {
      text: chunk => {
        title += chunk.text
      },
    })
    .on(HIDDEN_ELEMENTS, {
      element: element => {
        // An element closed by its own tag, `<svg />`, never has an end tag to count
        if (element.selfClosing || !element.canHaveContent) return

        hiddenDepth++
        element.onEndTag(() => {
          hiddenDepth--
        })
      },
    })
    .onDocument({
      text: chunk => {
        if (!hiddenDepth) chunks.push(chunk.text)
      },
    })
    .transform(new Response(html))
    .text()

  return {
    title: readText(title),
    description: readText(tags.get('og:description') ?? tags.get('description')),
    text: readText(chunks.join(' ')).slice(0, DIRECTORY_PAGE_MAX_TEXT_LENGTH),
    links: [...links],
  }
}

// A link to another page of the same site, its fragment left out, or null
function readLink(href: string | null, pageUrl: string, siteHost: string) {
  if (!href) return null

  try {
    const url = new URL(decodeHTML(href).trim(), pageUrl)

    url.hash = ''

    if (!['http:', 'https:'].includes(url.protocol) || toSiteHost(url.href) !== siteHost) return null
    if (ASSET_PATTERN.test(url.pathname) || url.href === pageUrl) return null

    return url.href
  } catch {
    return null
  }
}

function readText(value: string | undefined) {
  return value ? decodeHTML(value).replace(/\s+/g, ' ').trim() : ''
}

export default readDirectoryPage
