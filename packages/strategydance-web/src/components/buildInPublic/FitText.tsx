import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

type Fit = {
  // The largest and smallest font sizes to try, in pixels
  max: number
  min: number
  // How many lines it may wrap to before it is cut
  lines: number
  lineHeight: number
}

/*
  Sizes a text to its box: the largest size from `max` down to `min` at which it fits on one line,
  else the largest at which it fits on `lines`, else `min`, cut with an ellipsis. A search on the
  element itself, since how wide a name runs depends on its letters, not on how many there are
*/
function fitText(element: HTMLElement, { max, min, lines, lineHeight }: Fit) {
  const { style } = element

  if (!element.clientWidth) return

  Object.assign(style, { display: '', WebkitLineClamp: '', WebkitBoxOrient: '', textOverflow: '' })

  function fits(fontSize: number, lineCount: number) {
    style.fontSize = `${fontSize}px`
    style.whiteSpace = lineCount > 1 ? 'normal' : 'nowrap'

    return (
      element.scrollWidth <= element.clientWidth + 0.5 && element.scrollHeight <= fontSize * lineHeight * lineCount + 1
    )
  }

  function search(lineCount: number) {
    if (!fits(min, lineCount)) return null
    if (fits(max, lineCount)) return max

    let low = min
    let high = max

    while (high - low > 0.25) {
      const middle = (low + high) / 2

      if (fits(middle, lineCount)) low = middle
      else high = middle
    }

    return Math.floor(low * 4) / 4
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

  style.fontSize = `${min}px`

  if (lines > 1) {
    Object.assign(style, {
      whiteSpace: 'normal',
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: String(lines),
    })
  } else {
    Object.assign(style, { whiteSpace: 'nowrap', textOverflow: 'ellipsis' })
  }
}

type Props = {
  as?: 'span' | 'p'
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
  max,
  min = Math.round(max * 0.75),
  lines = 1,
  lineHeight = 1.25,
  className,
  children,
}: Props) {
  // Either element's, whichever `as` draws
  const ref = useRef<HTMLParagraphElement & HTMLSpanElement>(null)

  // After every render, since the text or its box may have changed with it
  useLayoutEffect(() => {
    if (ref.current) fitText(ref.current, { max, min, lines, lineHeight })
  })

  // And once the fonts are in, since a fallback face measures differently
  useEffect(() => {
    let isCancelled = false

    document.fonts.ready.then(() => {
      if (!isCancelled && ref.current) fitText(ref.current, { max, min, lines, lineHeight })
    })

    return () => {
      isCancelled = true
    }
  }, [max, min, lines, lineHeight])

  return (
    <Tag
      ref={ref}
      className={cn('min-w-0 overflow-hidden wrap-normal', className)}
      style={{ lineHeight }}
    >
      {children}
    </Tag>
  )
}

export default FitText
