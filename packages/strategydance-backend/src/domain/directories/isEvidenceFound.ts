import type { DirectoryEvidence, DirectoryPage } from '~types'

import isQuotedIn from '~domain/directories/isQuotedIn'

/*
  Whether a review's evidence is on the page it names: a page the check read, this server's probe or
  Claude's web fetch, at that address, holds the quote. The address is compared with its scheme and
  port, so a page of another origin never vouches for it, and without its `www.`, its fragment or a
  trailing slash, as a reader means it
*/
function isEvidenceFound({ quote, url }: DirectoryEvidence, pages: DirectoryPage[]) {
  const address = toPageAddress(url)

  return !!address && pages.some(page => toPageAddress(page.url) === address && isQuotedIn(quote, page.text))
}

function toPageAddress(url: string) {
  try {
    const { protocol, host, pathname, search } = new URL(url)

    return `${protocol}//${host.replace(/^www\./, '')}${pathname.replace(/\/+$/, '')}${search}`
  } catch {
    return null
  }
}

export default isEvidenceFound
