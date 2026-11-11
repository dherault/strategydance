import { describe, expect, it } from 'bun:test'

import parseDirectoriesSearch from '~utils/directory/parseDirectoriesSearch'

describe('parseDirectoriesSearch', () => {
  it('reads a tab, leaving To do, the default, out of the address, and overwrites anything else', () => {
    expect(parseDirectoriesSearch({ view: 'listed' })).toEqual({ view: 'listed' })
    expect(parseDirectoriesSearch({ view: 'all' })).toEqual({ view: 'all' })
    expect(parseDirectoriesSearch({ view: 'todo' })).toEqual({ view: undefined })
    expect(parseDirectoriesSearch({ view: 1000 })).toEqual({ view: undefined })
    expect(parseDirectoriesSearch({})).toEqual({ view: undefined })
  })
})
