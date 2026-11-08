// How long after its finger lifts a tap's click can still come
const TAP_CLICK_WAIT = 1000

/*
  Swallows the click of the touch whose pointerdown closed a modal popup, as Radix's Select. While
  the popup is open, Radix turns pointer events off outside it, so a mouse's click lands on the page
  and does nothing. A tap's click comes once the popup has closed and reaches whatever lies under the
  finger: the popup's trigger or its label, which open it again, or any button or link. Swallowed,
  a tap outside only closes the popup, as a click does.

  The wait ends at that click, the touch's cancellation, a new touch or a second after the finger
  lifts, so a click with no tap of its own, a key's or an assistive technology's, is never taken for
  it. `ownerDocument` is where the popup lives, `document` but in a test
*/
function swallowTapClick(pointerId: number, ownerDocument: EventTarget = document) {
  const controller = new AbortController()
  const options = { capture: true, signal: controller.signal }
  const end = () => controller.abort()

  ownerDocument.addEventListener(
    'click',
    event => {
      event.preventDefault()
      event.stopPropagation()
      end()
    },
    options,
  )
  ownerDocument.addEventListener(
    'pointerup',
    event => {
      if ((event as PointerEvent).pointerId === pointerId) setTimeout(end, TAP_CLICK_WAIT)
    },
    options,
  )
  ownerDocument.addEventListener(
    'pointercancel',
    event => {
      if ((event as PointerEvent).pointerId === pointerId) end()
    },
    options,
  )
  // A primary pointer goes down only once the touch has lifted, while a second finger is not primary
  ownerDocument.addEventListener(
    'pointerdown',
    event => {
      if ((event as PointerEvent).isPrimary) end()
    },
    options,
  )
}

export { swallowTapClick, TAP_CLICK_WAIT }
