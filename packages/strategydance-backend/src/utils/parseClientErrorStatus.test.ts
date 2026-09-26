import { describe, expect, it } from 'bun:test'

import parseClientErrorStatus from './parseClientErrorStatus'

describe('parseClientErrorStatus', () => {
  it('reads the status of an exposed client error', () => {
    expect(parseClientErrorStatus({ expose: true, status: 400 })).toBe(400)
    expect(parseClientErrorStatus({ expose: true, statusCode: 413 })).toBe(413)
  })

  it('ignores an error that does not expose itself', () => {
    expect(parseClientErrorStatus({ status: 400 })).toBeNull()
    expect(parseClientErrorStatus(new Error('boom'))).toBeNull()
  })

  it('never honours a server error, exposed or not', () => {
    expect(parseClientErrorStatus({ expose: true, status: 503 })).toBeNull()
  })

  it('ignores anything that is not an object', () => {
    expect(parseClientErrorStatus(null)).toBeNull()
    expect(parseClientErrorStatus('400')).toBeNull()
  })
})
