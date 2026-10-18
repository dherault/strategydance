import { describe, expect, it } from 'bun:test'

import countMarkdownHazards, {
  MARKDOWN_HAZARD_LIMITS,
  isWithinMarkdownHazardLimits,
} from 'strategydance-design-system/lib/countMarkdownHazards'

describe('countMarkdownHazards', () => {
  it('counts nothing in prose', () => {
    expect(countMarkdownHazards('A reply, with a dash - inside, 3.5 times, and *emphasis*.')).toEqual({
      brackets: 0,
      listMarkers: 0,
      quoteDepth: 0,
      emphasisRun: 1,
    })
  })

  it('counts every bracket, opening and closing, wherever it is', () => {
    expect(countMarkdownHazards('[a](b) and ]c[ and [[d]]').brackets).toBe(8)
  })

  it('counts the list markers opening each line, nested and numbered ones, past indentation and quotes', () => {
    const text = ['- a', '  - - b', '1. c', '  12) d', '> - e', '+ f', '* g', '-h', '1.i', 'not - a marker'].join('\n')

    expect(countMarkdownHazards(text).listMarkers).toBe(8)
  })

  it('counts the deepest run of quote markers opening one line, spaced or not', () => {
    expect(countMarkdownHazards('> a\n>>> b\n> > > > c\nd > e').quoteDepth).toBe(4)
  })

  it('counts the longest run of asterisks or underscores, each apart', () => {
    expect(countMarkdownHazards('**bold** ___ *a*****_b').emphasisRun).toBe(5)
    expect(countMarkdownHazards('*_*_*_').emphasisRun).toBe(1)
  })

  it('reads CRLF and lone CRs as line breaks', () => {
    expect(countMarkdownHazards('- a\r\n- b\r- c').listMarkers).toBe(3)
    expect(countMarkdownHazards('> a\r\n>> b').quoteDepth).toBe(2)
  })
})

describe('isWithinMarkdownHazardLimits', () => {
  it('holds a text at each limit, and refuses one past it', () => {
    const shapes = {
      brackets: (count: number) => ']a '.repeat(count),
      listMarkers: (count: number) => '- a\n'.repeat(count),
      quoteDepth: (count: number) => `${'>'.repeat(count)} a`,
      emphasisRun: (count: number) => `${'*'.repeat(count)}a`,
    }

    for (const [hazard, shape] of Object.entries(shapes)) {
      const limit = MARKDOWN_HAZARD_LIMITS[hazard as keyof typeof shapes]

      expect(isWithinMarkdownHazardLimits(shape(limit))).toBe(true)
      expect(isWithinMarkdownHazardLimits(shape(limit + 1))).toBe(false)
    }
  })
})
