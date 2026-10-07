// The domain a cited page is on, without `www.`, which the sources list shows beside its title
function readConversationSourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default readConversationSourceDomain
