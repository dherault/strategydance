import { decodeHTML } from 'entities'

import { DIRECTORY_PAGE_MAX_TEXT_LENGTH } from '~domain/directories/directoryCheckSettings'

// What no reader sees: scripts, styles and the rest a browser does not draw as text
const HIDDEN_ELEMENTS = 'head, script, style, noscript, template, svg, iframe, object'

/*
  What a page shows a reader: its title, its description, and its text as a reader sees it, the
  text of its scripts, styles and head left out, decoded, its spaces folded and held to what a
  review quotes
*/
async function readDirectoryPage(html: string) {
  const tags = new Map<string, string>()
  const chunks: string[] = []
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
  }
}

function readText(value: string | undefined) {
  return value ? decodeHTML(value).replace(/\s+/g, ' ').trim() : ''
}

export default readDirectoryPage
