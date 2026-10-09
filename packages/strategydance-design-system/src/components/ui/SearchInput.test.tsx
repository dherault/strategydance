import { describe, expect, it } from 'bun:test'

import { renderToStaticMarkup } from 'react-dom/server'
import { SearchInput } from 'strategydance-design-system/components/ui/SearchInput'

// The element names from the root down to the input, which React keeps the input under only while
// they stay the same
function readPathToInput(markup: string) {
  const beforeInput = markup.slice(0, markup.indexOf('<input'))

  return [...beforeInput.matchAll(/<(\w+)[^>]*data-slot="([\w-]+)"/g)].map(([, tag, slot]) => `${tag}.${slot}`)
}

describe('SearchInput', () => {
  it('keeps the same elements around its input whether or not it shows an error', () => {
    const bare = renderToStaticMarkup(<SearchInput aria-label="Search" />)
    const failing = renderToStaticMarkup(
      <SearchInput
        aria-label="Search"
        error="Search with at most 8 words."
      />,
    )

    expect(readPathToInput(bare)).toEqual(['div.field', 'div.search-input'])
    expect(readPathToInput(failing)).toEqual(readPathToInput(bare))
    expect(failing).toContain('aria-invalid="true"')
    expect(failing).toContain('Search with at most 8 words.')
  })
})
