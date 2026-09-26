import { describe, expect, it } from 'bun:test'

import buildStorageDownloadUrl from './buildStorageDownloadUrl'

const BUCKET = 'strategydance.firebasestorage.app'

describe('buildStorageDownloadUrl', () => {
  it('writes the download host, the bucket, the escaped name and the token', () => {
    expect(buildStorageDownloadUrl({ origin: 'https://firebasestorage.googleapis.com', bucket: BUCKET, name: 'organizations/0f9c/logo/5d3c', token: 'abc-123' }))
      .toBe(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/organizations%2F0f9c%2Flogo%2F5d3c?alt=media&token=abc-123`)
  })

  it('writes the emulator host in development', () => {
    expect(buildStorageDownloadUrl({ origin: 'http://localhost:9199', bucket: BUCKET, name: 'a/b', token: 't' }))
      .toBe(`http://localhost:9199/v0/b/${BUCKET}/o/a%2Fb?alt=media&token=t`)
  })
})
