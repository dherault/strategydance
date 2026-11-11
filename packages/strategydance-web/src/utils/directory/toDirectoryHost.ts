// A directory's address as a card shows it under its name: the host alone, without `www.`, or the
// address itself when it is none a browser would read
function toDirectoryHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default toDirectoryHost
