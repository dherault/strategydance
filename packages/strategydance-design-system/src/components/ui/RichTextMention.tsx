import { FileTextIcon, SquareKanbanIcon } from 'lucide-react'
import { type MouseEvent, useEffect } from 'react'
import useRichTextMentions from 'strategydance-design-system/hooks/useRichTextMentions'
import { readRichTextMentionState } from 'strategydance-design-system/lib/readRichTextMentionState'
import {
  RICH_TEXT_CLASSES,
  type RichTextMention as RichTextMentionValue,
  getRichTextMentionTarget,
  getRichTextMentionWords,
} from 'strategydance-design-system/lib/richText'
import { splitRichTextMentionWords } from 'strategydance-design-system/lib/splitRichTextMentionWords'

type Props = {
  mention: RichTextMentionValue
}

/*
  A mention of a document or a task, as `RichText` draws it from the page's source, the way the
  editor draws it: what it names, with its icon and its live title, linking to it; gone, its words
  struck through and muted, which a screen reader hears said; or its icon and its words while the
  list is not read, asking for it, or when the page gives none.

  A click opens it in the app when the page says how, and the browser opens it otherwise, in a new
  tab, as it does with a modifier key or the middle button
*/
function RichTextMention({ mention }: Props) {
  const { source, labels } = useRichTextMentions()
  const target = getRichTextMentionTarget(mention)
  const words = getRichTextMentionWords(mention)
  const state = readRichTextMentionState(target, words, source)
  const list = source ? (target.kind === 'document' ? source.documents : source.tasks) : null
  const Icon = target.kind === 'document' ? FileTextIcon : SquareKanbanIcon
  const classes = RICH_TEXT_CLASSES.mention

  // Its icon and its words, the icon kept on the line with the first word
  function renderLabel(text: string) {
    const [first, rest] = splitRichTextMentionWords(text || labels.mentionUntitled)

    return (
      <>
        <span className={classes.lead}>
          <Icon
            aria-hidden
            className={classes.icon}
          />
          {first}
        </span>
        {rest}
      </>
    )
  }

  useEffect(() => {
    if (source && !list) source.request(target.kind)
  }, [source, list, target.kind])

  if (state.kind === 'found') {
    const open = source?.open

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
      if (!open || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      event.preventDefault()
      open(target)
    }

    return (
      <a
        href={state.href}
        {...(open ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        className={classes.link}
        onClick={handleClick}
      >
        {renderLabel(state.title)}
      </a>
    )
  }

  return (
    <span className={state.kind === 'gone' ? classes.gone : classes.words}>
      {renderLabel(words)}
      {state.kind === 'gone' ? (
        <span className="sr-only">
          {' '}
          {target.kind === 'document' ? labels.mentionDocumentGone : labels.mentionTaskGone}
        </span>
      ) : null}
    </span>
  )
}

export { RichTextMention }
