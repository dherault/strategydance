// The host of a server's address, as the table and the dialog show it, or the address itself when it
// is none
function getIntegrationHost(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export default getIntegrationHost
