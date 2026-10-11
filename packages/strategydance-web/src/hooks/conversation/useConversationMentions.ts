import { type KeyboardEvent, type RefObject, useId, useState } from 'react'

import type { KnowledgeDocumentSummary } from '~types'

import useOrganizationKnowledgeDocuments from '~hooks/knowledge/useOrganizationKnowledgeDocuments'

import isComposingKeyPress from '~utils/common/isComposingKeyPress'
import replaceTextareaRange from '~utils/common/replaceTextareaRange'
import buildConversationMentionEdit from '~utils/conversation/buildConversationMentionEdit'
import buildConversationMentionTrigger from '~utils/conversation/buildConversationMentionTrigger'
import filterConversationMentionDocuments from '~utils/conversation/filterConversationMentionDocuments'
import findConversationMentionQuery, {
  type ConversationMentionQuery,
} from '~utils/conversation/findConversationMentionQuery'
import serializeConversationMentions from '~utils/conversation/serializeConversationMentions'

/*
  The knowledge the composer's field mentions, and the list that suggests it while a mention is
  typed.

  Typing `@` opens the list on the organization's documents, the latest changed first, and what
  follows narrows it. The arrows move through it, Enter or Tab picks, and Escape closes it for
  that mention for good, the caret coming back to it included, so an Enter meant to send never
  picks what the reader turned down. That holds while the text up to its `@` stays as it was: an
  `@` deleted and typed again is another mention. A pick writes `@Title` in the field and tracks
  the document by its title, the last pick winning when two share one, so the message is sent with
  each `@Title` as `[Title](doc:<id>)`. Moving the caret off the mention, or leaving the field,
  closes the list.

  A composer drawn again starts with the mentions it tracked, beside the words that hold them.

  The documents are read from the field's first focus, so the list is ready by the time an `@` is
  typed, and the read is the thread's own, which costs nothing more. While they land the list
  waits rather than says nothing matches, and if they cannot be read an `@` stays plain text.

  What the field holds is read off the field itself, never from what was last drawn, so a caret
  moved by the arrows, the mouse or the field's own change reads the same. The list's rows never
  take the focus: the field names the highlighted one as its active descendant
*/
function useConversationMentions(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  // The documents the field's text mentions as it starts, by their titles
  initialMentions?: ReadonlyMap<string, string>,
) {
  const listId = useId()
  const [mentions, setMentions] = useState<ReadonlyMap<string, string>>(() => initialMentions ?? new Map())
  const [mentionQuery, setMentionQuery] = useState<ConversationMentionQuery | null>(null)
  // The mention whose list Escape closed, by where its `@` is and the text up to it
  const [dismissed, setDismissed] = useState<{ at: number; before: string } | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isEnabled, setIsEnabled] = useState(false)
  const { data: documents, initialLoading, hasFailed } = useOrganizationKnowledgeDocuments({ isEnabled })

  const openQuery =
    mentionQuery && mentionQuery.at !== dismissed?.at && !initialLoading && !hasFailed ? mentionQuery : null
  const matches = openQuery ? filterConversationMentionDocuments(documents, openQuery.query) : []
  // Nothing matching is said once something is typed, unless the words have moved on past a space,
  // or never started as a title would
  const isEmptyShown = !!openQuery && !matches.length && /^\S(.*\S)?$/.test(openQuery.query)
  const isListShown = matches.length > 0 || isEmptyShown
  const highlighted = Math.min(highlightedIndex, matches.length - 1)

  function getOptionId(index: number) {
    return `${listId}-${index}`
  }

  function enable() {
    setIsEnabled(true)
  }

  function close() {
    setMentionQuery(null)
  }

  // Reads the mention at the caret, when nothing is selected, and forgets what Escape closed once
  // the text up to its `@` has changed
  function detect() {
    const textarea = textareaRef.current

    if (!textarea) return

    const { value, selectionStart, selectionEnd } = textarea
    const next = selectionStart === selectionEnd ? findConversationMentionQuery(value, selectionStart, mentions) : null

    if (dismissed && value.slice(0, dismissed.at + 1) !== dismissed.before) setDismissed(null)
    if (next?.at === mentionQuery?.at && next?.query === mentionQuery?.query) return

    setMentionQuery(next)
    setHighlightedIndex(0)
  }

  // Writes the document's title over the mention being typed. The field's change reads a mention
  // there before the pick is tracked, so the list is closed after it
  function pick(document: KnowledgeDocumentSummary) {
    const textarea = textareaRef.current

    if (!textarea || !mentionQuery) return

    const title = document.title.trim()

    replaceTextareaRange(textarea, buildConversationMentionEdit(textarea.value, mentionQuery, title))
    setMentions(current => new Map(current).set(title, document.id))
    close()
  }

  // Writes an `@` at the caret, which the field's change reads as a mention to suggest for
  function insertTrigger() {
    const textarea = textareaRef.current

    if (!textarea) return

    replaceTextareaRange(
      textarea,
      buildConversationMentionTrigger(textarea.value, textarea.selectionStart, textarea.selectionEnd),
    )
  }

  // Whether the key press drove the list, which the field then does nothing else with
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!openQuery || !isListShown || isComposingKeyPress(event.nativeEvent)) return false

    if (event.key === 'Escape') {
      event.preventDefault()
      // The list is what Escape closes, not whatever holds the field
      event.stopPropagation()
      setDismissed({ at: openQuery.at, before: event.currentTarget.value.slice(0, openQuery.at + 1) })

      return true
    }

    const picked = matches[highlighted]

    if (!picked || event.altKey || event.ctrlKey || event.metaKey) return false

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((highlighted + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)

      return true
    }

    if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
      event.preventDefault()
      pick(picked)

      return true
    }

    return false
  }

  return {
    listId,
    getOptionId,
    // The documents the list suggests, and the one Enter would pick
    matches,
    highlightedIndex: highlighted,
    // What is typed after the `@`, while the list is open
    query: openQuery?.query ?? null,
    isListShown,
    enable,
    detect,
    close,
    highlight: setHighlightedIndex,
    pick,
    insertTrigger,
    handleKeyDown,
    // The documents picked, by the titles the text mentions them with
    tracked: mentions,
    // The message as it is sent, each mention a link to its document
    serialize: (text: string) => serializeConversationMentions(text, mentions),
    // Forgets every mention, once the message holding them is sent
    clear: () => {
      setMentions(new Map())
      setDismissed(null)
      close()
    },
  }
}

export default useConversationMentions
