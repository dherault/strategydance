import type { DirectoryEvidence, DirectoryPage } from '~types'

import isQuotedIn from '~domain/directories/isQuotedIn'

/*
  The page a review's evidence is on, or null: the page the check read, by this server's probe or
  Claude's web fetch, at the address the evidence names, holding its quote. The address is compared with its scheme and
  port, so a page of another origin never vouches for it, and without its `www.`, its fragment or a
  trailing slash, as a reader means it
*/
function findEvidencePage({ quote, url }: DirectoryEvidence, pages: DirectoryPage[]) {
  const address = toPageAddress(url)

  return (address && pages.find(page => toPageAddress(page.url) === address && isQuotedIn(quote, page.text))) || null
}

function toPageAddress(url: string) {
  try {
    const { protocol, host, pathname, search } = new URL(url)

    return `${protocol}//${host.replace(/^www\./, '')}${pathname.replace(/\/+$/, '')}${search}`
  } catch {
    return null
  }
}

export default findEvidencePage
