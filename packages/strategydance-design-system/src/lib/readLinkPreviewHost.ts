// The host a link preview names its page by, a web address's without its `www.`, or null for anything
// that is not a web address
function readLinkPreviewHost(url: string) {
  try {
    const parsed = new URL(url)

    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

export { readLinkPreviewHost }
