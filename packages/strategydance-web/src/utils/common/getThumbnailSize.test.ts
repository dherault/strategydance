import { describe, expect, it } from 'bun:test'

import getThumbnailSize from '~utils/common/getThumbnailSize'

describe('getThumbnailSize', () => {
  it('brings the longer side down to the square, keeping the proportions', () => {
    expect(getThumbnailSize({ width: 1024, height: 1024 }, 256)).toEqual({ width: 256, height: 256 })
    expect(getThumbnailSize({ width: 4000, height: 3000 }, 256)).toEqual({ width: 256, height: 192 })
    expect(getThumbnailSize({ width: 600, height: 2400 }, 256)).toEqual({ width: 64, height: 256 })
  })

  it('rounds to whole pixels', () => {
    expect(getThumbnailSize({ width: 1000, height: 333 }, 256)).toEqual({ width: 256, height: 85 })
  })

  it('leaves a picture that fits already at its size', () => {
    expect(getThumbnailSize({ width: 200, height: 120 }, 256)).toEqual({ width: 200, height: 120 })
    expect(getThumbnailSize({ width: 256, height: 256 }, 256)).toEqual({ width: 256, height: 256 })
  })

  it('keeps a pixel of a picture too thin to round to one', () => {
    expect(getThumbnailSize({ width: 10000, height: 4 }, 256)).toEqual({ width: 256, height: 1 })
  })
})
