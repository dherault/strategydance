import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'

import readConversationViewport from '~utils/conversation/readConversationViewport'
import scrollConversationToEnd from '~utils/conversation/scrollConversationToEnd'

// How near the bottom the reader counts as reading the latest, which the thread then follows
const BOTTOM_SLACK_PX = 80

type ScrollPlace = {
  isAtBottom: boolean
  // The entries the reader can see, first to last, and where the top of each was then. Several,
  // so that when another tab's Retry deletes the first, the next one still holds the place
  anchors: { id: string; top: number }[]
}

function isAtBottom(scroller: HTMLElement | null) {
  if (scroller) return scroller.clientHeight + scroller.scrollTop >= scroller.scrollHeight - BOTTOM_SLACK_PX

  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - BOTTOM_SLACK_PX
}

// Where the reader is, read after each of their scrolls
function measure(list: HTMLElement | null, scroller: HTMLElement | null, place: ScrollPlace) {
  place.isAtBottom = isAtBottom(scroller)
  place.anchors = []

  if (!list) return

  const viewport = readConversationViewport(scroller)

  for (const element of list.querySelectorAll<HTMLElement>('[data-entry-id]')) {
    const { top, bottom } = element.getBoundingClientRect()

    if (top >= viewport.bottom) return
    if (bottom > viewport.top) place.anchors.push({ id: element.dataset.entryId!, top })
  }
}

// Puts the reader back where they were once what is drawn has changed size
function restore(list: HTMLElement | null, scroller: HTMLElement | null, place: ScrollPlace) {
  if (place.isAtBottom) {
    scrollConversationToEnd(scroller)

    return
  }

  if (!list) return

  for (const anchor of place.anchors) {
    const element = list.querySelector<HTMLElement>(`[data-entry-id="${anchor.id}"]`)

    if (!element) continue

    const shift = element.getBoundingClientRect().top - anchor.top

    if (shift) (scroller ?? window).scrollBy({ top: shift })

    return
  }
}

/*
  Keeps a conversation's reader where they read. The page opens on the latest message and follows
  what arrives while the reader is at the bottom, bodies landing after the first paint included.
  Scrolled up, the first entry they see stays where it is whatever changes around it: older pages
  added above, a body replacing its placeholder, entries another tab's Retry took away. When the
  Retry took that very entry, the first one of those they saw that is left holds the place.

  On the conversation's page the window scrolls, not the thread; in a dock's window, the box the
  window holds the thread in, `scrollerRef`. Browsers anchor a scroll by themselves, but Safari does
  not, and Chrome's would add to this, so the thread opts out of theirs (`overflow-anchor: none`) and
  this does it everywhere: after every render, and whenever the list changes size, or the box does,
  which a dock's composer shrinks as it grows
*/
function useConversationThreadScroll(
  listRef: RefObject<HTMLElement | null>,
  // The box the thread scrolls in, or none when the window scrolls it
  scrollerRef?: RefObject<HTMLElement | null>,
) {
  const placeRef = useRef<ScrollPlace>({ isAtBottom: true, anchors: [] })

  useLayoutEffect(() => {
    restore(listRef.current, scrollerRef?.current ?? null, placeRef.current)
  })

  useEffect(() => {
    const list = listRef.current
    const scroller = scrollerRef?.current ?? null
    const scrolled = scroller ?? window
    const place = placeRef.current

    function handleScroll() {
      measure(list, scroller, place)
    }

    const observer = new ResizeObserver(() => restore(list, scroller, place))

    scrolled.addEventListener('scroll', handleScroll, { passive: true })

    if (list) observer.observe(list)
    if (scroller) observer.observe(scroller)

    return () => {
      scrolled.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [listRef, scrollerRef])
}

export default useConversationThreadScroll
