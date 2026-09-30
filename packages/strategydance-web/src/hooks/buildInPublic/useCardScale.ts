import { type RefObject, useLayoutEffect, useState } from 'react'

/*
  How much a card is drawn smaller than its size to fit the width of the element around it, and
  never larger than its size: a landscape card is wider than a phone. Measured before the first
  paint and again as that width changes, so the card never shows wider than the page first
*/
function useCardScale(ref: RefObject<HTMLElement | null>, cardWidth: number) {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const element = ref.current

    if (!element) return

    function measure(width: number) {
      if (width > 0) setScale(Math.min(1, width / cardWidth))
    }

    measure(element.clientWidth)

    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width)
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [ref, cardWidth])

  return scale
}

export default useCardScale
