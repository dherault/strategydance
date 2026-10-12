import type { BlockNoteEditor } from '@blocknote/core'
import type { RichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import {
  normalizeRichTextMentionId,
  normalizeRichTextMentionWords,
} from 'strategydance-design-system/lib/normalizeRichText'
import { readRichTextMentionState } from 'strategydance-design-system/lib/readRichTextMentionState'
import type { RichTextMentionKind, RichTextMentionSource } from 'strategydance-design-system/lib/richText'
import { RichTextMentionsExtension } from 'strategydance-design-system/lib/richTextMentionsExtension'

// Lucide's file-text and square-kanban, which the thread's links to documents and tasks draw
const ICONS: Record<RichTextMentionKind, string> = {
  document:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  task: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/></svg>',
}

type Mention = {
  kind: RichTextMentionKind
  /** Its id and its words as its node holds them, which arrive through Yjs unchecked */
  id: unknown
  words: unknown
}

/*
  A mention as the editor draws it, a span whatever it draws, so a copied mention pastes back as
  one rather than as a link, which an outer link would be read as first: what it names, found,
  as a link with its icon and its live title; gone, as its words with the icon, struck through and
  muted, which a screen reader hears said; or its words with the icon while the list is not read,
  or when its id is none. Its id and words are checked as `normalizeRichText` checks them, since a
  shared text reaches the editor without it, and text goes in as text.

  Drawn live in the editor, it follows the page's source, asking for the list it needs, and a
  click on it opens what it names: in the app when the page says how, and in a new tab otherwise,
  or with a modifier key or the middle button. Drawn to be copied, it is its icon and its words
  and listens to nothing
*/
function createRichTextMentionChip(
  { kind, id, words: rawWords }: Mention,
  editor: BlockNoteEditor<any, any, any>,
  isLive: boolean,
) {
  const chip = document.createElement('span')
  const canonicalId = normalizeRichTextMentionId(id)
  const target = canonicalId ? { kind, id: canonicalId } : null
  const words = normalizeRichTextMentionWords(rawWords)
  const labels = (editor.dictionary as RichTextDictionary).rich_text
  const store = isLive ? editor.getExtension(RichTextMentionsExtension)?.store : undefined

  // What the chip draws, so a change to the source that leaves it alone redraws nothing
  let drawn = ''

  chip.className = 'rich-text-mention'
  chip.dataset.kind = kind

  function createLabel(text: string) {
    const icon = document.createElement('span')
    const label = document.createElement('span')

    icon.className = 'rich-text-mention-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = ICONS[kind]
    label.textContent = text || labels.mention_untitled

    return [icon, label]
  }

  function draw(source: RichTextMentionSource | null) {
    const state = readRichTextMentionState(target, words, source)
    const open = source?.open

    if (source && target && !(target.kind === 'document' ? source.documents : source.tasks)) source.request(target.kind)

    const next = state.kind === 'found' ? `found ${!!open} ${state.href} ${state.title}` : state.kind

    if (next === drawn) return

    drawn = next
    chip.dataset.state = state.kind

    if (state.kind === 'found') {
      const link = document.createElement('a')

      link.className = 'rich-text-mention-link'
      link.href = state.href
      link.draggable = false
      link.append(...createLabel(state.title))
      link.addEventListener('click', event => {
        event.preventDefault()

        if (open && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) open(state.target)
        else window.open(state.href, '_blank', 'noopener,noreferrer')
      })
      link.addEventListener('auxclick', event => {
        if (event.button !== 1) return

        event.preventDefault()
        window.open(state.href, '_blank', 'noopener,noreferrer')
      })
      chip.replaceChildren(link)

      return
    }

    chip.replaceChildren(...createLabel(words))

    if (state.kind === 'gone' && isLive) {
      const gone = document.createElement('span')

      gone.className = 'rich-text-mention-hidden'
      gone.textContent = ` ${kind === 'document' ? labels.mention_document_gone : labels.mention_task_gone}`
      chip.append(gone)
    }
  }

  draw(store?.state ?? null)

  return { dom: chip, destroy: store?.subscribe(({ currentVal }) => draw(currentVal)) }
}

// A mention as it is copied out of the editor, for another application: its words alone
function createRichTextMentionWords(words: unknown) {
  const fragment = document.createDocumentFragment()

  fragment.append(normalizeRichTextMentionWords(words))

  return fragment
}

export { createRichTextMentionChip, createRichTextMentionWords }
