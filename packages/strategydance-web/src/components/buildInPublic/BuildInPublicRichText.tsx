import { useRef } from 'react'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import { cn } from 'strategydance-design-system/lib/utils'

import useIsOverflowing from '~hooks/buildInPublic/useIsOverflowing'

type Props = {
  // A Lexical editor state, serialized, which is somebody's to write and so is drawn through `RichText`
  value: string
  // Where it sits on the card, such as `mt-auto`
  className?: string
  // How its text is set, such as its size, over the card's colors
  textClassName?: string
}

/*
  The design system's rich text in the card's colors on any tone, its list markers and quote bars
  in the accent. A list's markers are drawn before each item rather than as the list's own
  markers, which a card's picture does not copy. The item Lexical nests a list in, `list-none` in
  the rich text's theme, draws none.

  It takes the room its card leaves it and no more: a long text gives way rather than pushing what
  is under it off the card, and fades out where it is cut rather than ending on half a line
*/
const CARD_RICH_TEXT_CLASS_NAME = cn(
  'text-inherit',
  '[&_blockquote]:border-(--card-mark) [&_blockquote]:text-(--card-quote)',
  '[&_ol]:list-none [&_ol]:[counter-reset:card-item] [&_ul]:list-none',
  '[&_li]:relative [&_li:not(.list-none)]:before:absolute [&_li:not(.list-none)]:before:right-[calc(100%+0.5em)] [&_li:not(.list-none)]:before:text-(--card-mark)',
  "[&_ul>li:not(.list-none)]:before:content-['•']",
  "[&_ol>li:not(.list-none)]:[counter-increment:card-item] [&_ol>li:not(.list-none)]:before:content-[counter(card-item)'.']",
)

function BuildInPublicRichText({ value, className, textClassName }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isOverflowing = useIsOverflowing(ref)

  return (
    <div
      ref={ref}
      className={cn(
        'min-h-0 overflow-hidden',
        isOverflowing && '[mask-image:linear-gradient(to_bottom,#000_calc(100%-2.5em),transparent)]',
        className,
      )}
    >
      <RichText
        value={value}
        className={cn(CARD_RICH_TEXT_CLASS_NAME, textClassName)}
      />
    </div>
  )
}

export default BuildInPublicRichText
