import { useRef } from 'react'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import { cn } from 'strategydance-design-system/lib/utils'

import useIsOverflowing from '~hooks/buildInPublic/useIsOverflowing'

type Props = {
  // BlockNote's blocks, serialized, which are somebody's to write and so are drawn through `RichText`
  value: string
  // Where it sits on the card, such as `mt-auto`
  className?: string
  // How its text is set, such as its size, over the card's colors
  textClassName?: string
  // In the display face, with room below for its descenders
  isDisplay?: boolean
}

/*
  The design system's rich text in the card's colors on any tone, its list markers, quote bars,
  links and ticked boxes in the accent, and its unticked boxes as the checklist card draws them. A
  list's markers are drawn before each item rather than as the list's own markers, which a card's
  picture does not copy. A check item draws its box instead.

  It takes the room its card leaves it and no more: a long text gives way rather than pushing what
  is under it off the card, and fades out where it is cut rather than ending on half a line. The
  box that cuts it is set as its text is, so that the room it keeps below for the display face's
  descenders is in the text's ems. The fade is in rems, as long as it was when the box took the
  page's 16px
*/
const CARD_RICH_TEXT_CLASS_NAME = cn(
  'text-inherit',
  '[&_blockquote]:border-(--card-mark) [&_blockquote]:text-(--card-quote)',
  '[&_a]:text-(--card-mark)',
  '[&_ol]:list-none [&_ol]:[counter-reset:card-item] [&_ul]:list-none',
  '[&_li]:relative [&_li:not([data-checked])]:before:absolute [&_li:not([data-checked])]:before:right-[calc(100%+0.5em)] [&_li:not([data-checked])]:before:text-(--card-mark)',
  "[&_ul>li:not([data-checked])]:before:content-['•']",
  "[&_ol>li]:[counter-increment:card-item] [&_ol>li]:before:content-[counter(card-item)'.']",
  '[&_[data-check-box]]:border-(--card-box-border) [&_[data-check-box]]:bg-(--card-box) [&_[data-check-box]]:text-(--card-box-check)',
  '[&_[data-checked=true]>label>[data-check-box]]:border-(--card-mark) [&_[data-checked=true]>label>[data-check-box]]:bg-(--card-mark)',
)

function BuildInPublicRichText({ value, className, textClassName, isDisplay = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isOverflowing = useIsOverflowing(ref)

  return (
    <div
      ref={ref}
      className={cn(
        'min-h-0 overflow-hidden',
        textClassName,
        isDisplay && 'descender-room',
        isOverflowing && '[mask-image:linear-gradient(to_bottom,#000_calc(100%-2.5rem),transparent)]',
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
