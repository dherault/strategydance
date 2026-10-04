import { createBlockSpec } from '@blocknote/core'
import { createRichTextAddButton } from 'strategydance-design-system/lib/createRichTextAddButton'
import { parseVideoEmbedUrl } from 'strategydance-design-system/lib/parseVideoEmbedUrl'

// Lucide's square-play, as the slash menu's item draws it
const VIDEO_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>'

/*
  A video played in its provider's own player, YouTube's, Vimeo's or Loom's: the address of its
  page is what is stored, and the player is built from it, so no stored address points the player
  anywhere else. One with no address, or one no provider plays, is the place a video is about to
  go, which opens the file panel. The player is loaded only once it nears the screen, it may play
  full screen and open the provider's page, and it tells the provider which site it is on, without
  which YouTube refuses to play.

  A block of the core's rather than a React one, so the editor that converts a document without
  ever drawing it loads no React. A pasted player, YouTube's embed code say, comes in as one
*/
const createVideoEmbedBlockSpec = createBlockSpec(
  {
    type: 'videoEmbed',
    propSchema: {
      url: { default: '' },
    },
    content: 'none',
  },
  {
    // A file block that takes no file, for the stylesheet's rules for a picture's place
    meta: { fileBlockAccept: [] },
    parse: element => {
      if (element.tagName !== 'IFRAME') return undefined

      const embed = parseVideoEmbedUrl(element.getAttribute('src'))

      return embed ? { url: embed.url } : undefined
    },
    render: (block, editor) => {
      const embed = parseVideoEmbedUrl(block.props.url)

      if (!embed) {
        return createRichTextAddButton(block.id, editor, {
          icon: VIDEO_ICON,
          text: editor.dictionary.file_blocks.add_button_text.video,
        })
      }

      const player = document.createElement('div')
      const frame = document.createElement('iframe')

      player.className = 'rich-text-video-embed'
      frame.src = embed.src
      frame.title = embed.providerName
      frame.loading = 'lazy'
      frame.allow = 'fullscreen; picture-in-picture; encrypted-media'
      frame.allowFullscreen = true
      frame.referrerPolicy = 'strict-origin-when-cross-origin'
      frame.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox',
      )
      player.append(frame)

      return { dom: player }
    },
    // A link to the video, where the page a copy lands in plays nothing
    toExternalHTML: block => {
      const embed = parseVideoEmbedUrl(block.props.url)

      if (!embed) return { dom: document.createElement('p') }

      const link = document.createElement('a')

      link.href = embed.url
      link.textContent = embed.url

      return { dom: link }
    },
  },
)

export { createVideoEmbedBlockSpec }
