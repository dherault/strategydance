// A web address's host without its `www.`, the site a reader means, or nothing for what is no address
function toSiteHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default toSiteHost
