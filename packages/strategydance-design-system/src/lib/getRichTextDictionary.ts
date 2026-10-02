import type { Dictionary } from '@blocknote/core'
import { de, en, es, fr, ja, pt, zh } from '@blocknote/core/locales'

// BlockNote's own translations of its menus, for the locales the app speaks
const DICTIONARIES: Record<string, Dictionary> = { de, en, es, fr, ja, pt, zh }

type Overrides = {
  /** What the empty document says */
  placeholder: string
}

/*
  BlockNote's words for its menus in `locale`, the app's locale code ('FR'), or in English where it
  has none, with the field's own placeholder laid over them. A later empty line keeps BlockNote's
  hint that '/' opens the menu
*/
function getRichTextDictionary(locale: string | undefined, { placeholder }: Overrides): Dictionary {
  const dictionary = DICTIONARIES[locale?.toLowerCase() ?? 'en'] ?? en

  return {
    ...dictionary,
    placeholders: { ...dictionary.placeholders, emptyDocument: placeholder },
  }
}

export { getRichTextDictionary }
