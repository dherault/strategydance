import { describe, expect, it } from 'bun:test'

import { isOrganizationSlug } from 'strategydance-core'

import isOrganizationPathSegment from '~utils/organization/isOrganizationPathSegment'

const routeTree = await Bun.file(new URL('./routeTree.gen.ts', import.meta.url)).text()

/*
  The full paths the router plugin generated, read as text rather than imported, since importing
  the tree would evaluate every page
*/
function readFullPaths() {
  const match = /fullPaths:\s*((?:\|\s*'[^']*'\s*)+)/.exec(routeTree)

  if (!match) throw new Error('No fullPaths in routeTree.gen.ts')

  return [...match[1]!.matchAll(/'([^']*)'/g)].map(([, path]) => path!)
}

/*
  An organization's pages sit under a dynamic segment at the root, which a static route there
  outranks without a word: an organization whose slug was a page's name could never be reached.
  A slug always ends in a dash and four characters, which no page's name does, and this fails the
  day one does
*/
describe('routeTree.gen.ts', () => {
  it("names no page at the root that an organization's slug or id could be", () => {
    const rootSegments = new Set(
      readFullPaths()
        .map(path => path.split('/')[1]!)
        .filter(segment => segment && !segment.startsWith('$')),
    )

    expect(rootSegments.size).toBeGreaterThan(0)

    for (const segment of rootSegments) {
      expect(isOrganizationSlug(segment)).toBe(false)
      expect(isOrganizationPathSegment(segment)).toBe(false)
    }
  })

  it("puts an organization's pages under its segment", () => {
    expect(readFullPaths()).toContain('/$organizationSlug/today')
  })
})
