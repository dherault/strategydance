import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

import { CARD_DISPLAY_CLASS_NAME } from '~components/buildInPublic/cardClassNames'

/*
  How far below its lines the display face reaches, in ems: its descenders hang past a line box
  as tight as the cards set it, and the element hides what overflows it. The room is padding the
  fit counts, taken back by a negative margin, so the layout does not move
*/
const DISPLAY_DESCENDER_ROOM = 0.25

/*
  The room below a text clamped to its lines, less than the room a whole text keeps: the lines are
  set tighter than the face is tall, so the tops of the first line cut off reach up into the full
  room. This is as far down as the descenders above them go
*/
const CLAMPED_DESCENDER_ROOM = 0.12

type Fit = {
  // The largest and smallest font sizes to try, in pixels
  max: number
  min: number
  // How many lines it may wrap to before it is cut
  lines: number
  lineHeight: number
  // Room below the lines for descenders, in ems
  descenderRoom: number
}

/*
  Sizes a text to its box: the largest size from `max` down to `min` at which it fits on one line,
  else the largest at which it fits on `lines`, else `min`, cut with an ellipsis. A search on the
  element itself, since how wide a name runs depends on its letters, not on how many there are.

  In whole pixels, since a card's picture floors every font size it draws: a fitted size of 14.75px
  would come out at 13.9px, a size smaller than the card on the page
*/
function fitText(element: HTMLElement, { max, min, lines, lineHeight, descenderRoom }: Fit) {
  const { style } = element

  if (!element.clientWidth) return

  Object.assign(style, { display: '', WebkitLineClamp: '', WebkitBoxOrient: '', textOverflow: '', overflowWrap: '' })

  function setSize(fontSize: number, roomEms = descenderRoom) {
    const room = fontSize * roomEms

    style.fontSize = `${fontSize}px`
    style.paddingBottom = room ? `${room}px` : ''
    style.marginBottom = room ? `${-room}px` : ''
  }

  function fits(fontSize: number, lineCount: number) {
    setSize(fontSize)
    style.whiteSpace = lineCount > 1 ? 'normal' : 'nowrap'

    return (
      element.scrollWidth <= element.clientWidth + 0.5
      && element.scrollHeight <= fontSize * (lineHeight * lineCount + descenderRoom) + 1
    )
  }

  function search(lineCount: number) {
    if (!fits(min, lineCount)) return null
    if (fits(max, lineCount)) return max

    let low = min
    let high = max

    while (high - low > 1) {
      const middle = (low + high) / 2

      if (fits(middle, lineCount)) low = middle
      else high = middle
    }

    return Math.max(min, Math.floor(low))
  }

  let lineCount = 1
  let fontSize = search(1)

  if (fontSize === null && lines > 1) {
    lineCount = lines
    fontSize = search(lines)
  }

  if (fontSize !== null) {
    fits(fontSize, lineCount)

    return
  }

  if (lines > 1) {
    setSize(min, Math.min(descenderRoom, CLAMPED_DESCENDER_ROOM))

    // A word too long for a line breaks inside it here, rather than running out of the box where
    // nothing marks it cut: only a clamp across whole lines ends in an ellipsis
    Object.assign(style, {
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: String(lines),
    })
  } else {
    setSize(min)
    Object.assign(style, { whiteSpace: 'nowrap', textOverflow: 'ellipsis' })
  }
}

type Props = {
  as?: 'span' | 'p'
  // In the display face, with room below for its descenders
  isDisplay?: boolean
  max: number
  min?: number
  lines?: number
  lineHeight?: number
  className?: string
  children: ReactNode
}

// A text that shrinks to fit, such as an organization's name beside its logo: see `fitText`
function FitText({
  as: Tag = 'span',
  isDisplay = false,
  max,
  min = Math.round(max * 0.75),
  lines = 1,
  lineHeight = 1.25,
  className,
  children,
}: Props) {
  // Either element's, whichever `as` draws
  const ref = useRef<HTMLParagraphElement & HTMLSpanElement>(null)

  const descenderRoom = isDisplay ? DISPLAY_DESCENDER_ROOM : 0

  // After every render, since the text or its box may have changed with it
  useLayoutEffect(() => {
    if (ref.current) fitText(ref.current, { max, min, lines, lineHeight, descenderRoom })
  })

  // And once the fonts are in, since a fallback face measures differently
  useEffect(() => {
    let isCancelled = false

    document.fonts.ready.then(() => {
      if (!isCancelled && ref.current) fitText(ref.current, { max, min, lines, lineHeight, descenderRoom })
    })

    return () => {
      isCancelled = true
    }
  }, [max, min, lines, lineHeight, descenderRoom])

  return (
    <Tag
      ref={ref}
      className={cn('min-w-0 overflow-hidden wrap-normal', isDisplay && CARD_DISPLAY_CLASS_NAME, className)}
      style={{ lineHeight }}
    >
      {children}
    </Tag>
  )
}

export default FitText
