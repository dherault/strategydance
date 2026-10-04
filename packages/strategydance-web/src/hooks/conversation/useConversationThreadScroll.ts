import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'

// How near the bottom the reader counts as reading the latest, which the thread then follows
const BOTTOM_SLACK_PX = 80

type ScrollPlace = {
  isAtBottom: boolean
  // The entries the reader can see, first to last, and where the top of each was then. Several,
  // so that when another tab's Retry deletes the first, the next one still holds the place
  anchors: { id: string; top: number }[]
}

// Where the reader is, read after each of their scrolls
function measure(list: HTMLElement | null, place: ScrollPlace) {
  place.isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - BOTTOM_SLACK_PX
  place.anchors = []

  if (!list) return

  for (const element of list.querySelectorAll<HTMLElement>('[data-entry-id]')) {
    const { top, bottom } = element.getBoundingClientRect()

    if (top >= window.innerHeight) return
    if (bottom > 0) place.anchors.push({ id: element.dataset.entryId!, top })
  }
}

// Puts the reader back where they were once what is drawn has changed size
function restore(list: HTMLElement | null, place: ScrollPlace) {
  if (place.isAtBottom) {
    window.scrollTo({ top: document.documentElement.scrollHeight })

    return
  }

  if (!list) return

  for (const anchor of place.anchors) {
    const element = list.querySelector<HTMLElement>(`[data-entry-id="${anchor.id}"]`)

    if (!element) continue

    const shift = element.getBoundingClientRect().top - anchor.top

    if (shift) window.scrollBy({ top: shift })

    return
  }
}

/*
  Keeps a conversation's reader where they read. The page opens on the latest message and follows
  what arrives while the reader is at the bottom, bodies landing after the first paint included.
  Scrolled up, the first entry they see stays where it is whatever changes around it: older pages
  added above, a body replacing its placeholder, entries another tab's Retry took away. When the
  Retry took that very entry, the first one of those they saw that is left holds the place.

  The window scrolls, not the thread. Browsers anchor a scroll by themselves, but Safari does not,
  and Chrome's would add to this, so the thread opts out of theirs (`overflow-anchor: none`) and
  this does it everywhere: after every render, and whenever the list changes size
*/
function useConversationThreadScroll(listRef: RefObject<HTMLElement | null>) {
  const placeRef = useRef<ScrollPlace>({ isAtBottom: true, anchors: [] })

  useLayoutEffect(() => {
    restore(listRef.current, placeRef.current)
  })

  useEffect(() => {
    const list = listRef.current
    const place = placeRef.current

    function handleScroll() {
      measure(list, place)
    }

    const observer = new ResizeObserver(() => restore(list, place))

    window.addEventListener('scroll', handleScroll, { passive: true })

    if (list) observer.observe(list)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [listRef])
}

export default useConversationThreadScroll
