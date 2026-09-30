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

  it('gives the size in the font shorthand back its whole pixels, and only the size', () => {
    const svg =
      '<p style="font: 400 13.9px / 21px &quot;Inter Variable&quot;, sans-serif; letter-spacing: 0.9px;">a</p>'

    expect(fromDataUrl(repairCardSvg(toDataUrl(svg)))).toBe(
      '<p style="font: 400 14px / 21px &quot;Inter Variable&quot;, sans-serif; letter-spacing: 0.9px;">a</p>',
    )
  })

  it('leaves a line height in the font shorthand alone, even one that looks floored', () => {
    const svg = '<p style="font: 400 14px / 20.9px sans-serif;">a</p>'

    expect(fromDataUrl(repairCardSvg(toDataUrl(svg)))).toBe(svg)
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
