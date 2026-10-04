import {
  FilePanel,
  type FilePanelProps,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
} from '@blocknote/react'
import { type ChangeEvent, type FC, useState } from 'react'
import type { RichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { parseVideoEmbedUrl } from 'strategydance-design-system/lib/parseVideoEmbedUrl'
import type { RichTextLinkPreview } from 'strategydance-design-system/lib/richText'

type PreviewLink = (url: string) => Promise<RichTextLinkPreview>

/*
  The panel that opens over a block waiting for its file or its address in `RichTextEditor`: a
  picture's is BlockNote's own, with its Upload and Embed tabs, a video's takes the link to a
  YouTube, Vimeo or Loom video, and a link preview's the link to any page, which `previewLink`
  reads. Made once per editor, with the editor's `previewLink`
*/
function createRichTextEditorFilePanel(previewLink: PreviewLink | undefined): FC<FilePanelProps> {
  return function RichTextEditorFilePanel({ blockId }: FilePanelProps) {
    const editor = useBlockNoteEditor()
    const dictionary = useDictionary()
    // The editor's schema is its own, which BlockNote's default types leave out
    const type: string | undefined = editor.getBlock(blockId)?.type
    const tab =
      type === 'videoEmbed' ? (
        <VideoEmbedTab blockId={blockId} />
      ) : type === 'linkPreview' ? (
        <LinkPreviewTab
          blockId={blockId}
          previewLink={previewLink}
        />
      ) : null

    if (!tab) return <FilePanel blockId={blockId} />

    return (
      <FilePanel
        blockId={blockId}
        tabs={[{ name: dictionary.file_panel.embed.title, tabPanel: tab }]}
      />
    )
  }
}

/*
  A link to a video, which the block keeps as its provider writes it, or says it is no video one
  plays. A form, as BlockNote's Embed tab is, so Enter and a phone's action key send it too
*/
function VideoEmbedTab({ blockId }: FilePanelProps) {
  const Components = useComponentsContext()!
  const dictionary = useDictionary() as RichTextDictionary
  const editor = useBlockNoteEditor()
  const [url, setUrl] = useState('')
  const [isUnsupported, setIsUnsupported] = useState(false)

  function changeUrl(event: ChangeEvent<HTMLInputElement>) {
    setUrl(event.currentTarget.value)
    setIsUnsupported(false)
  }

  function embed() {
    const video = parseVideoEmbedUrl(url)

    if (!video) {
      setIsUnsupported(true)

      return
    }

    if (editor.getBlock(blockId)) editor.updateBlock(blockId, { props: { url: video.url } })
  }

  return (
    <Components.FilePanel.TabPanel className="bn-tab-panel">
      <Components.Generic.Form.Root
        onSubmit={embed}
        submitButton={
          <Components.FilePanel.Button
            className="bn-button"
            type="submit"
          >
            {dictionary.file_panel.embed.embed_button.video}
          </Components.FilePanel.Button>
        }
      >
        <Components.FilePanel.TextInput
          className="bn-text-input"
          placeholder={dictionary.file_panel.embed.url_placeholder}
          value={url}
          onChange={changeUrl}
        />
      </Components.Generic.Form.Root>
      {isUnsupported ? (
        <p
          role="alert"
          className="bn-error-text"
        >
          {dictionary.rich_text.video_embed_unsupported}
        </p>
      ) : null}
    </Components.FilePanel.TabPanel>
  )
}

/*
  A link to any web page, an address without its protocol read as an https one, which the block
  keeps with what the page says of itself, as `previewLink` reads it. Without one, or when it
  fails, the card is the address alone. The panel waits for the answer, a ring turning on its
  button meanwhile, and the block takes it even when the panel has closed since
*/
function LinkPreviewTab({ blockId, previewLink }: FilePanelProps & { previewLink: PreviewLink | undefined }) {
  const Components = useComponentsContext()!
  const dictionary = useDictionary() as RichTextDictionary
  const editor = useBlockNoteEditor()
  const [url, setUrl] = useState('')
  const [isInvalid, setIsInvalid] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  function changeUrl(event: ChangeEvent<HTMLInputElement>) {
    setUrl(event.currentTarget.value)
    setIsInvalid(false)
  }

  async function preview() {
    if (isLoading) return

    const address = readWebAddress(url)

    if (!address) {
      setIsInvalid(true)

      return
    }

    setIsLoading(true)

    const alone: RichTextLinkPreview = { url: address }
    const page = previewLink ? await previewLink(address).catch(() => alone) : alone

    setIsLoading(false)

    if (!editor.getBlock(blockId)) return

    editor.updateBlock(blockId, {
      props: {
        url: address,
        title: page.title ?? '',
        description: page.description ?? '',
        siteName: page.siteName ?? '',
        imageUrl: page.imageUrl ?? '',
      },
    } as never)
  }

  return (
    <Components.FilePanel.TabPanel className="bn-tab-panel">
      <Components.Generic.Form.Root
        onSubmit={preview}
        submitButton={
          <Components.FilePanel.Button
            className="bn-button"
            type="submit"
          >
            {isLoading ? (
              <span
                aria-hidden="true"
                className="rich-text-panel-spinner"
              />
            ) : null}
            {dictionary.rich_text.link_preview_button}
          </Components.FilePanel.Button>
        }
      >
        <Components.FilePanel.TextInput
          className="bn-text-input"
          placeholder={dictionary.file_panel.embed.url_placeholder}
          value={url}
          onChange={changeUrl}
        />
      </Components.Generic.Form.Root>
      {isInvalid ? (
        <p
          role="alert"
          className="bn-error-text"
        >
          {dictionary.rich_text.link_preview_invalid}
        </p>
      ) : null}
    </Components.FilePanel.TabPanel>
  )
}

// A web address as the URL parser writes it, `example.com/page` read as https, or null
function readWebAddress(value: string) {
  const text = value.trim()
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`

  try {
    const url = new URL(candidate)

    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.') ? url.href : null
  } catch {
    return null
  }
}

export { createRichTextEditorFilePanel }
