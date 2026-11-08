import { afterEach, describe, expect, it, jest } from 'bun:test'

import { swallowTapClick, TAP_CLICK_WAIT } from 'strategydance-design-system/lib/swallowTapClick'

// An event dispatched on the page, which says whether it was stopped, since the flag `cancelBubble`
// reads is cleared once the dispatch ends
function dispatch(page: EventTarget, type: string, fields: { pointerId?: number; isPrimary?: boolean } = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), fields, { isStopped: false })

  event.stopPropagation = () => {
    event.isStopped = true
    Event.prototype.stopPropagation.call(event)
  }
  page.dispatchEvent(event)

  return event
}

// Whether a click on the page was kept from the element under the finger and from its default
// action, a label's or a link's
function isSwallowed(click: Event & { isStopped: boolean }) {
  return click.isStopped && click.defaultPrevented
}

afterEach(() => {
  jest.useRealTimers()
})

describe('swallowTapClick', () => {
  it("swallows the tap's click", () => {
    const page = new EventTarget()

    swallowTapClick(1, page)
    dispatch(page, 'pointerup', { pointerId: 1 })

    expect(isSwallowed(dispatch(page, 'click'))).toBe(true)
  })

  it('lets every click after the swallowed one through', () => {
    const page = new EventTarget()

    swallowTapClick(1, page)
    dispatch(page, 'click')
    const click = dispatch(page, 'click')

    expect(click.isStopped).toBe(false)
    expect(click.defaultPrevented).toBe(false)
  })

  it('stops waiting when the touch is cancelled, as a scroll does', () => {
    const page = new EventTarget()

    swallowTapClick(1, page)
    dispatch(page, 'pointercancel', { pointerId: 1 })

    expect(isSwallowed(dispatch(page, 'click'))).toBe(false)
  })

  it('stops waiting at a new touch, whose click is its own', () => {
    const page = new EventTarget()

    swallowTapClick(1, page)
    dispatch(page, 'pointerup', { pointerId: 1 })
    dispatch(page, 'pointerdown', { pointerId: 2, isPrimary: true })

    expect(isSwallowed(dispatch(page, 'click'))).toBe(false)
  })

  it("keeps waiting through a second finger's touch, for the first one's click", () => {
    const page = new EventTarget()

    swallowTapClick(1, page)
    dispatch(page, 'pointerdown', { pointerId: 2, isPrimary: false })
    dispatch(page, 'pointercancel', { pointerId: 2 })
    dispatch(page, 'pointerup', { pointerId: 1 })

    expect(isSwallowed(dispatch(page, 'click'))).toBe(true)
  })

  it('stops waiting a while after the finger lifts, so a later click without a tap goes through', () => {
    jest.useFakeTimers()
    const page = new EventTarget()

    swallowTapClick(1, page)
    dispatch(page, 'pointerup', { pointerId: 1 })
    jest.advanceTimersByTime(TAP_CLICK_WAIT - 1)
    const early = dispatch(page, 'click')

    swallowTapClick(1, page)
    dispatch(page, 'pointerup', { pointerId: 1 })
    jest.advanceTimersByTime(TAP_CLICK_WAIT)
    const late = dispatch(page, 'click')

    expect(isSwallowed(early)).toBe(true)
    expect(isSwallowed(late)).toBe(false)
  })

  it("counts the wait from the touch's own finger lifting, not another's", () => {
    jest.useFakeTimers()
    const page = new EventTarget()

    swallowTapClick(1, page)
    dispatch(page, 'pointerup', { pointerId: 2 })
    jest.advanceTimersByTime(TAP_CLICK_WAIT * 5)

    expect(isSwallowed(dispatch(page, 'click'))).toBe(true)
  })
})
