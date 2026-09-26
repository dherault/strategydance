import { describe, expect, it } from 'bun:test'

import buildStorageDownloadUrl from './buildStorageDownloadUrl'
import parseStorageObjectName from './parseStorageObjectName'

const BUCKET = 'strategydance.firebasestorage.app'
const NAME = 'organizations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/logo/5d3c4b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'

describe('parseStorageObjectName', () => {
  it('reads back the name a download URL was built with, from either host', () => {
    for (const origin of ['https://firebasestorage.googleapis.com', 'http://localhost:9199']) {
      expect(parseStorageObjectName(buildStorageDownloadUrl({ origin, bucket: BUCKET, name: NAME, token: 't' }), BUCKET)).toBe(NAME)
    }
  })

  it('answers null for another bucket', () => {
    expect(parseStorageObjectName(buildStorageDownloadUrl({ origin: 'http://localhost:9199', bucket: 'elsewhere', name: NAME, token: 't' }), BUCKET)).toBeNull()
  })

  it('answers null for a path that is not one escaped name', () => {
    expect(parseStorageObjectName(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/`, BUCKET)).toBeNull()
    expect(parseStorageObjectName(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/a/b`, BUCKET)).toBeNull()
    expect(parseStorageObjectName(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/%E0%A4%A`, BUCKET)).toBeNull()
  })

  it('answers null for something that is not a URL', () => {
    expect(parseStorageObjectName('not a url', BUCKET)).toBeNull()
  })
})
