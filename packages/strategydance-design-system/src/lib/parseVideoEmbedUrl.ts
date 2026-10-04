/** A video a document plays in its provider's own player */
type VideoEmbed = {
  provider: 'youtube' | 'vimeo' | 'loom'
  /** The provider's name, which titles its player */
  providerName: string
  /** The video's page, written one way whatever way it was given in, which is what is stored */
  url: string
  /** The player's address, which is derived from the video and never stored */
  src: string
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
// The paths a video's id follows on youtube.com, a page of its own or a player
const YOUTUBE_PATHS = new Set(['shorts', 'embed', 'live', 'v'])

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com'])
const VIMEO_ID = /^\d{1,12}$/
// The key an unlisted video's address carries, without which its player refuses it
const VIMEO_HASH = /^[0-9a-f]{6,20}$/

const LOOM_HOSTS = new Set(['loom.com', 'www.loom.com'])
const LOOM_ID = /^[0-9a-f]{32}$/

/*
  The video a web address shows on YouTube, Vimeo or Loom, by its exact host and the shapes of
  address each gives a video, or null for anything else. The player's address is built from the
  video's id alone, so a stored address can never point a document's player anywhere but these
  three: YouTube's through its domain that sets no cookie until the video plays, at the time a
  YouTube address starts it at
*/
function parseVideoEmbedUrl(value: unknown): VideoEmbed | null {
  if (typeof value !== 'string') return null

  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be' || YOUTUBE_HOSTS.has(host)) {
    const id =
      host === 'youtu.be'
        ? segments[0]
        : segments[0] === 'watch'
          ? url.searchParams.get('v')
          : YOUTUBE_PATHS.has(segments[0] ?? '')
            ? segments[1]
            : null

    return id && YOUTUBE_ID.test(id)
      ? createYoutubeEmbed(id, readSeconds(url.searchParams.get('t') ?? url.searchParams.get('start')))
      : null
  }

  if (VIMEO_HOSTS.has(host) || host === 'player.vimeo.com') {
    const [id, hash] =
      host === 'player.vimeo.com' ? (segments[0] === 'video' ? [segments[1], url.searchParams.get('h')] : []) : segments

    if (!id || !VIMEO_ID.test(id)) return null

    const key = hash && VIMEO_HASH.test(hash) ? hash : null

    return {
      provider: 'vimeo',
      providerName: 'Vimeo',
      url: `https://vimeo.com/${id}${key ? `/${key}` : ''}`,
      src: `https://player.vimeo.com/video/${id}${key ? `?h=${key}` : ''}`,
    }
  }

  if (LOOM_HOSTS.has(host) && (segments[0] === 'share' || segments[0] === 'embed')) {
    const id = segments[1]

    if (!id || !LOOM_ID.test(id)) return null

    return {
      provider: 'loom',
      providerName: 'Loom',
      url: `https://www.loom.com/share/${id}`,
      src: `https://www.loom.com/embed/${id}`,
    }
  }

  return null
}

function createYoutubeEmbed(id: string, start: number | null): VideoEmbed {
  return {
    provider: 'youtube',
    providerName: 'YouTube',
    url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`,
    src: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`,
  }
}

// A YouTube start time in seconds, written as `90`, `90s` or `1h2m3s`, or null
function readSeconds(value: string | null) {
  const match = value ? /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value) : null

  if (!match) return null

  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)

  return seconds > 0 ? seconds : null
}

export { parseVideoEmbedUrl, type VideoEmbed }
