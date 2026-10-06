import { createBlockSpec } from '@blocknote/core'
import { createRichTextAddButton } from 'strategydance-design-system/lib/createRichTextAddButton'
import type { RichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'

// Lucide's link, as the slash menu's item draws it
const LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'

// Lucide's external-link, on the card's corner
const OPEN_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'

/*
  A card linking to a web page: what the page said of itself when the card was added, which the
  backend read for it, its site, and its picture, loaded from wherever the page names it and told
  nothing of this one. One with no address is the place a card is about to go, which opens the file
  panel. A click on the card selects it, as on any block, and the arrow in its corner opens the page
  in a new tab, which learns nothing of this one.

  A block of the core's rather than a React one, so the editor that converts a document without
  ever drawing it loads no React. Everything it says is set as text
*/
const createLinkPreviewBlockSpec = createBlockSpec(
  {
    type: 'linkPreview',
    propSchema: {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      siteName: { default: '' },
      imageUrl: { default: '' },
    },
    content: 'none',
  },
  {
    // A file block that takes no file, for the stylesheet's rules for a picture's place
    meta: { fileBlockAccept: [] },
    render: (block, editor) => {
      const { url, title, description, siteName, imageUrl } = block.props
      const host = readHost(url)

      if (!host) {
        return createRichTextAddButton(block.id, editor, {
          icon: LINK_ICON,
          text: (editor.dictionary as RichTextDictionary).rich_text.link_preview_add,
        })
      }

      const card = document.createElement('div')
      const text = document.createElement('div')

      card.className = 'rich-text-link-preview'
      text.className = 'rich-text-link-preview-text'
      text.append(
        createText('rich-text-link-preview-title', title || host),
        ...(description ? [createText('rich-text-link-preview-description', description)] : []),
        createText('rich-text-link-preview-site', siteName ? `${siteName} · ${host}` : host),
      )
      card.append(text)

      if (imageUrl.startsWith('https://')) {
        // As tall as the words beside it, whatever the picture's own shape
        const media = document.createElement('div')
        const image = document.createElement('img')

        media.className = 'rich-text-link-preview-media'
        image.className = 'rich-text-link-preview-image'
        image.src = imageUrl
        image.alt = ''
        image.loading = 'lazy'
        image.decoding = 'async'
        image.referrerPolicy = 'no-referrer'
        image.draggable = false
        // A picture the site took down leaves the words alone
        image.addEventListener('error', () => media.remove(), { once: true })
        media.append(image)
        card.append(media)
      }

      const open = document.createElement('a')

      open.className = 'rich-text-link-preview-open'
      open.href = url
      open.target = '_blank'
      open.rel = 'noopener noreferrer nofollow'
      open.title = host
      open.setAttribute('aria-label', host)
      open.innerHTML = OPEN_ICON
      card.append(open)

      return { dom: card }
    },
    // A link to the page, titled as the card is
    toExternalHTML: block => {
      const host = readHost(block.props.url)

      if (!host) return { dom: document.createElement('p') }

      const link = document.createElement('a')

      link.href = block.props.url
      link.textContent = block.props.title || block.props.url

      return { dom: link }
    },
  },
)

// The host of a web address, without its `www.`, or null for anything that is not one
function readHost(url: string) {
  try {
    const parsed = new URL(url)

    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

function createText(className: string, text: string) {
  const element = document.createElement('p')

  element.className = className
  element.textContent = text

  return element
}

export { createLinkPreviewBlockSpec }
