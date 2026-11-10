import { describe, expect, it } from 'bun:test'

import toDirectoryHost from '~utils/directory/toDirectoryHost'

describe('toDirectoryHost', () => {
  it('gives the host without www., or the address itself when it is none', () => {
    expect(toDirectoryHost('https://www.betalist.com/submit')).toBe('betalist.com')
    expect(toDirectoryHost('https://launched.lovable.app/')).toBe('launched.lovable.app')
    expect(toDirectoryHost('not an address')).toBe('not an address')
  })
})
