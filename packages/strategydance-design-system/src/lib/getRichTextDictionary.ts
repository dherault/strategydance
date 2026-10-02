import type { Dictionary } from '@blocknote/core'
import { de, en, es, fr, ja, pt, zh } from '@blocknote/core/locales'

// BlockNote's own translations of its menus, for the locales the app speaks
const DICTIONARIES: Record<string, Dictionary> = { de, en, es, fr, ja, pt, zh }

type Overrides = {
  /** What the empty document says */
  placeholder: string
  /** The block menu's item that turns a block into another, which BlockNote has no words for */
  turnInto?: string
}

/** BlockNote's dictionary with the words the editor adds to its menus */
type RichTextDictionary = Dictionary & {
  drag_handle: Dictionary['drag_handle'] & { turn_into_menuitem: string }
}

/*
  BlockNote's words for its menus in `locale`, the app's locale code ('FR'), or in English where it
  has none, with the field's own placeholder laid over them and the block menu's "Turn into" added,
  in English unless the caller's catalogue says otherwise. A later empty line keeps BlockNote's hint
  that '/' opens the menu
*/
function getRichTextDictionary(
  locale: string | undefined,
  { placeholder, turnInto = 'Turn into' }: Overrides,
): RichTextDictionary {
  const dictionary = DICTIONARIES[locale?.toLowerCase() ?? 'en'] ?? en

  return {
    ...dictionary,
    placeholders: { ...dictionary.placeholders, emptyDocument: placeholder },
    drag_handle: { ...dictionary.drag_handle, turn_into_menuitem: turnInto },
  }
}

export { getRichTextDictionary, type RichTextDictionary }
