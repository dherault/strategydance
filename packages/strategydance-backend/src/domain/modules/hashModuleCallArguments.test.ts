import { describe, expect, it } from 'bun:test'

import hashModuleCallArguments from './hashModuleCallArguments'

describe('hashModuleCallArguments', () => {
  it('hashes arguments the same whatever order their keys come in, at every depth', () => {
    expect(hashModuleCallArguments({ id: 'a', replaceText: { find: 'x', replace: 'y' } })).toBe(
      hashModuleCallArguments({ replaceText: { replace: 'y', find: 'x' }, id: 'a' }),
    )
  })

  it('leaves out a key whose value is undefined, as JSON does', () => {
    expect(hashModuleCallArguments({ id: 'a', title: undefined })).toBe(hashModuleCallArguments({ id: 'a' }))
  })

  it('tells other arguments apart, the order of a list included', () => {
    const hash = hashModuleCallArguments({ id: 'a', aspects: ['SALES', 'LEGAL'] })

    expect(hashModuleCallArguments({ id: 'b', aspects: ['SALES', 'LEGAL'] })).not.toBe(hash)
    expect(hashModuleCallArguments({ id: 'a', aspects: ['LEGAL', 'SALES'] })).not.toBe(hash)
    expect(hashModuleCallArguments({ id: 'a', aspects: ['SALES', 'LEGAL'], title: null })).not.toBe(hash)
  })

  it('writes SHA-256 in hex', () => {
    expect(hashModuleCallArguments({})).toMatch(/^[0-9a-f]{64}$/)
  })
})
