import {
  FilePanel,
  type FilePanelProps,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
} from '@blocknote/react'
import { type ChangeEvent, useState } from 'react'
import type { RichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { parseVideoEmbedUrl } from 'strategydance-design-system/lib/parseVideoEmbedUrl'

/*
  The panel that opens over a block waiting for its file or its address in `RichTextEditor`: a
  picture's is BlockNote's own, with its Upload and Embed tabs, and a video's takes the link to a
  YouTube, Vimeo or Loom video
*/
function RichTextEditorFilePanel({ blockId }: FilePanelProps) {
  const editor = useBlockNoteEditor()
  const dictionary = useDictionary()
  // The editor's schema is its own, which BlockNote's default types leave out
  const type: string | undefined = editor.getBlock(blockId)?.type

  if (type === 'videoEmbed') {
    return (
      <FilePanel
        blockId={blockId}
        tabs={[{ name: dictionary.file_panel.embed.title, tabPanel: <VideoEmbedTab blockId={blockId} /> }]}
      />
    )
  }

  return <FilePanel blockId={blockId} />
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

export { RichTextEditorFilePanel }
