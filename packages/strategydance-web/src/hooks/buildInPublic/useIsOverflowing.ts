import { type RefObject, useLayoutEffect, useState } from 'react'

/*
  Whether an element's content runs past the bottom of its box, as a text given less room on a
  card than it takes. Measured before the first paint, and again whenever the box or what is in it
  changes size, as it does once the fonts are in
*/
function useIsOverflowing(ref: RefObject<HTMLElement | null>) {
  const [isOverflowing, setIsOverflowing] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current

    if (!element) return

    function measure() {
      if (element) setIsOverflowing(element.scrollHeight > element.clientHeight + 1)
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(element)

    for (const child of element.children) observer.observe(child)

    return () => observer.disconnect()
  }, [ref])

  return isOverflowing
}

export default useIsOverflowing
