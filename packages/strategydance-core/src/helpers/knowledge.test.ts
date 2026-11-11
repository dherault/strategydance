import { describe, expect, it } from 'bun:test'

import { DirectoryStatus } from '../enums'

import { isDirectoryStatusInUse, readDirectoryStatus } from './knowledge'

describe('readDirectoryStatus', () => {
  it('reads a directory without a row, or with none given, as to do', () => {
    expect(readDirectoryStatus(null)).toBeNull()
    expect(readDirectoryStatus(undefined)).toBeNull()
    expect(readDirectoryStatus({ isInUse: false, directoryStatus: null })).toBeNull()
  })

  it('reads the status a row was given', () => {
    for (const status of Object.values(DirectoryStatus)) {
      expect(readDirectoryStatus({ isInUse: isDirectoryStatusInUse(status), directoryStatus: status })).toBe(status)
    }
  })

  it('reads a row from before statuses, in use with none, as submitted', () => {
    expect(readDirectoryStatus({ isInUse: true, directoryStatus: null })).toBe(DirectoryStatus.SUBMITTED)
    expect(readDirectoryStatus({ isInUse: true })).toBe(DirectoryStatus.SUBMITTED)
  })
})

describe('isDirectoryStatusInUse', () => {
  it('counts a directory submitted to or listed as in use, and no other', () => {
    expect(isDirectoryStatusInUse(DirectoryStatus.SUBMITTED)).toBe(true)
    expect(isDirectoryStatusInUse(DirectoryStatus.LISTED)).toBe(true)
    expect(isDirectoryStatusInUse(DirectoryStatus.DISMISSED)).toBe(false)
    expect(isDirectoryStatusInUse(null)).toBe(false)
  })
})
