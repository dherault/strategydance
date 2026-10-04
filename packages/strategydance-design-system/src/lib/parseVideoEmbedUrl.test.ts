import { describe, expect, it } from 'bun:test'

import { parseVideoEmbedUrl } from 'strategydance-design-system/lib/parseVideoEmbedUrl'

const YOUTUBE = {
  provider: 'youtube',
  providerName: 'YouTube',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
} as const

describe('parseVideoEmbedUrl', () => {
  it("reads a YouTube video from each address YouTube gives it, playing it from YouTube's cookieless domain", () => {
    for (const address of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'http://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      '  https://YOUTU.BE/dQw4w9WgXcQ  ',
    ]) {
      expect(parseVideoEmbedUrl(address)).toEqual(YOUTUBE)
    }
  })

  it('keeps the time a YouTube address starts its video at', () => {
    expect(parseVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=90')).toMatchObject({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s',
      src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90',
    })
    expect(parseVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s')?.src).toEndWith('?start=3723')
    expect(parseVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=soon')?.src).toEndWith('dQw4w9WgXcQ')
  })

  it('reads a Vimeo video, with the key of an unlisted one', () => {
    expect(parseVideoEmbedUrl('https://vimeo.com/76979871')).toEqual({
      provider: 'vimeo',
      providerName: 'Vimeo',
      url: 'https://vimeo.com/76979871',
      src: 'https://player.vimeo.com/video/76979871',
    })
    expect(parseVideoEmbedUrl('https://vimeo.com/76979871/8f2a1c3b4d')).toMatchObject({
      url: 'https://vimeo.com/76979871/8f2a1c3b4d',
      src: 'https://player.vimeo.com/video/76979871?h=8f2a1c3b4d',
    })
    expect(parseVideoEmbedUrl('https://player.vimeo.com/video/76979871?h=8f2a1c3b4d')?.url).toBe(
      'https://vimeo.com/76979871/8f2a1c3b4d',
    )
  })

  it('reads a Loom video from its share or embed address', () => {
    const id = '0123456789abcdef0123456789abcdef'

    for (const address of [`https://www.loom.com/share/${id}?sid=x`, `https://loom.com/embed/${id}`]) {
      expect(parseVideoEmbedUrl(address)).toEqual({
        provider: 'loom',
        providerName: 'Loom',
        url: `https://www.loom.com/share/${id}`,
        src: `https://www.loom.com/embed/${id}`,
      })
    }
  })

  it('reads nothing else, a look-alike host or a malformed id included', () => {
    for (const address of [
      'https://example.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/channel/UCabc',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="x',
      'https://vimeo.com/channels/staffpicks',
      'https://www.loom.com/share/not-an-id',
      'javascript:alert(1)//youtu.be/dQw4w9WgXcQ',
      'youtu.be/dQw4w9WgXcQ',
      '',
      undefined,
    ]) {
      expect(parseVideoEmbedUrl(address)).toBeNull()
    }
  })
})
