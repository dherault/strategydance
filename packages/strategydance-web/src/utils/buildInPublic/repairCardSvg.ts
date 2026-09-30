const DATA_URL_PREFIX = 'data:image/svg+xml;charset=utf-8,'

// A size as html-to-image floored it, given back its whole pixels, and any other as it is
function unfloor(size: string) {
  const match = /^(\d+)\.9px$/.exec(size)

  return match ? `${Number(match[1]) + 1}px` : size
}

/*
  One element's inline style, as html-to-image copied it off the page, put back to what the page
  drew. Where the browser reports no `cssText` for a computed style, as Chrome and Firefox do, the
  library copies each property on its own, and two of them come out wrong:

  - A clamped text's `display` reads `flow-root` rather than the `-webkit-box` its class set, and
    without it the clamp does nothing: the text is cut at the height it had, with no ellipsis
  - Every font size is written as its whole pixels less a tenth, a margin the library keeps
    against text running wider in the picture, so 14px comes out at 13.9px and lines break
    elsewhere than on the page. The cards' sizes are whole pixels, which this gives back. The
    browser writes the size in the `font` shorthand where it can fold the other font properties
    in with it, and there the size is the first length, since a weight has no unit
*/
function repairStyle(style: string) {
  const isClamped = /(?:^|;)\s*-webkit-line-clamp:\s*\d+/.test(style)
  const repaired = style
    .replace(/((?:^|;)\s*font-size:\s*)([^;]+)/g, (_, before: string, size: string) => before + unfloor(size))
    .replace(
      /((?:^|;)\s*font:\s*)([^;]+)/g,
      (_, before: string, font: string) => before + font.replace(/\d+(?:\.\d+)?px/, unfloor),
    )

  return isClamped ? repaired.replace(/((?:^|;)\s*display:\s*)flow-root/, '$1-webkit-box') : repaired
}

/*
  A card as html-to-image serialized it, a data URL of an SVG holding the card's clone, with each
  element's style repaired to draw as the page does. Anything that is not such a data URL is
  handed back as it is
*/
function repairCardSvg(dataUrl: string) {
  if (!dataUrl.startsWith(DATA_URL_PREFIX)) return dataUrl

  const svg = decodeURIComponent(dataUrl.slice(DATA_URL_PREFIX.length))
  const repaired = svg.replace(/ style="([^"]*)"/g, (_, style: string) => ` style="${repairStyle(style)}"`)

  return `${DATA_URL_PREFIX}${encodeURIComponent(repaired)}`
}

export default repairCardSvg
