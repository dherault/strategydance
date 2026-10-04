import type { Dictionary } from '@blocknote/core'
import { de, en, es, fr, ja, pt, zh } from '@blocknote/core/locales'

// BlockNote's own translations of its menus, for the locales the app speaks
const DICTIONARIES: Record<string, Dictionary> = { de, en, es, fr, ja, pt, zh }

/** The menus' words BlockNote has none for, which the caller's catalogue gives */
type RichTextLabels = {
  /** The block menu's item that turns a block into another */
  turnInto: string
  /** What the slash menu says under "Video": where a video is played from */
  videoEmbedSubtext: string
  /** What the video's panel says of a link it cannot play */
  videoEmbedUnsupported: string
}

const ENGLISH_LABELS: RichTextLabels = {
  turnInto: 'Turn into',
  videoEmbedSubtext: 'A YouTube, Vimeo or Loom video',
  videoEmbedUnsupported: 'Paste a link to a YouTube, Vimeo or Loom video',
}

type Overrides = Partial<RichTextLabels> & {
  /** What the empty document says */
  placeholder: string
}

/** BlockNote's dictionary with the words the editor adds to its menus */
type RichTextDictionary = Dictionary & {
  drag_handle: Dictionary['drag_handle'] & { turn_into_menuitem: string }
  rich_text: { video_embed_subtext: string; video_embed_unsupported: string }
}

/*
  BlockNote's words for its menus in `locale`, the app's locale code ('FR'), or in English where it
  has none, with the field's own placeholder laid over them and the words the editor adds, in
  English unless the caller's catalogue says otherwise. A later empty line keeps BlockNote's hint
  that '/' opens the menu
*/
function getRichTextDictionary(
  locale: string | undefined,
  { placeholder, ...overrides }: Overrides,
): RichTextDictionary {
  const dictionary = DICTIONARIES[locale?.toLowerCase() ?? 'en'] ?? en
  const labels = { ...ENGLISH_LABELS, ...overrides }

  return {
    ...dictionary,
    placeholders: { ...dictionary.placeholders, emptyDocument: placeholder },
    drag_handle: { ...dictionary.drag_handle, turn_into_menuitem: labels.turnInto },
    rich_text: {
      video_embed_subtext: labels.videoEmbedSubtext,
      video_embed_unsupported: labels.videoEmbedUnsupported,
    },
  }
}

export { getRichTextDictionary, type RichTextDictionary, type RichTextLabels }
