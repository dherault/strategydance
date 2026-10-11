import { describe, expect, it } from 'bun:test'

import countShownDockWindows from '~utils/conversation/countShownDockWindows'

// The width the dock has beside the sidebar on a screen that wide: the sidebar's 256 pixels and a
// margin of 24 on each side taken out
function dockWidth(screenWidth: number) {
  return screenWidth - 256 - 48
}

describe('countShownDockWindows', () => {
  it('shows every window that fits', () => {
    expect(countShownDockWindows(dockWidth(1920), 1)).toBe(1)
    expect(countShownDockWindows(dockWidth(1920), 4)).toBe(4)
    expect(countShownDockWindows(dockWidth(1440), 3)).toBe(3)
  })

  it('shows as many as fit beside the "+N" button, and puts the rest behind it', () => {
    expect(countShownDockWindows(dockWidth(1920), 5)).toBe(4)
    expect(countShownDockWindows(dockWidth(1440), 4)).toBe(3)
    expect(countShownDockWindows(dockWidth(1024), 4)).toBe(1)
  })

  it('gives up a window to the "+N" button when both do not fit', () => {
    // Four windows take 1432 pixels, and the button 64 more with its gap
    expect(countShownDockWindows(1456, 4)).toBe(4)
    expect(countShownDockWindows(1456, 5)).toBe(3)
    expect(countShownDockWindows(1495, 5)).toBe(3)
    expect(countShownDockWindows(1496, 5)).toBe(4)
  })

  it('counts a window that only just fits', () => {
    expect(countShownDockWindows(352, 1)).toBe(1)
    expect(countShownDockWindows(352 * 2 + 8, 2)).toBe(2)
    expect(countShownDockWindows(352 * 2 + 7, 2)).toBe(1)
  })

  it('always shows one, however narrow', () => {
    expect(countShownDockWindows(200, 3)).toBe(1)
    expect(countShownDockWindows(0, 1)).toBe(1)
  })

  it('shows nothing when there is nothing to show', () => {
    expect(countShownDockWindows(dockWidth(1920), 0)).toBe(0)
  })
})
