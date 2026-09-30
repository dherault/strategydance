import { describe, expect, it } from 'bun:test'

import repairCardSvg from '~utils/buildInPublic/repairCardSvg'

const PREFIX = 'data:image/svg+xml;charset=utf-8,'

function toDataUrl(svg: string) {
  return `${PREFIX}${encodeURIComponent(svg)}`
}

function fromDataUrl(dataUrl: string) {
  return decodeURIComponent(dataUrl.slice(PREFIX.length))
}

describe('repairCardSvg', () => {
  it('gives each font size back its whole pixels', () => {
    const svg =
      '<p style="font-size: 13.9px; line-height: 20.85px;">a</p><p style="color: red; font-size: 29.9px;">b</p>'

    expect(fromDataUrl(repairCardSvg(toDataUrl(svg)))).toBe(
      '<p style="font-size: 14px; line-height: 20.85px;">a</p><p style="color: red; font-size: 30px;">b</p>',
    )
  })

  it('draws a clamped text as a box again, so the clamp cuts it with an ellipsis', () => {
    const svg =
      '<p style="display: flow-root; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3;">a</p>'

    expect(fromDataUrl(repairCardSvg(toDataUrl(svg)))).toBe(
      '<p style="display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3;">a</p>',
    )
  })

  it('leaves an element that is not clamped as it is', () => {
    const svg = '<div style="display: flow-root; -webkit-line-clamp: none;">a</div>'

    expect(fromDataUrl(repairCardSvg(toDataUrl(svg)))).toBe(svg)
  })

  it('touches only style attributes, never the text', () => {
    const svg = '<p title="font-size: 13.9px" style="font-size: 10.9px;">font-size: 13.9px</p>'

    expect(fromDataUrl(repairCardSvg(toDataUrl(svg)))).toBe(
      '<p title="font-size: 13.9px" style="font-size: 11px;">font-size: 13.9px</p>',
    )
  })

  it('leaves a size that was never floored alone', () => {
    const svg = '<p style="font-size: 12.5px; letter-spacing: 0.9px;">a</p>'

    expect(fromDataUrl(repairCardSvg(toDataUrl(svg)))).toBe(svg)
  })

  it('hands back anything that is not a serialized SVG', () => {
    expect(repairCardSvg('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })
})
