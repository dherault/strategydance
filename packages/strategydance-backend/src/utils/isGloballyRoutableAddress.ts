import ipaddr from 'ipaddr.js'

/*
  Whether an IP address is one on the public internet, the only kind this server reaches out to on
  another's behalf: an allowlist, `ipaddr.js`'s unicast range alone, so loopback, private,
  link-local (the metadata server at 169.254.169.254, which hands out the service's tokens),
  carrier-grade NAT, multicast, broadcast, unspecified, documentation and every other special-use
  range are refused, and so is an address that is not one. An IPv4 address written as IPv6 is read
  as the IPv4 address it is, and IPv6's ways of reaching IPv4 through a gateway, NAT64, 6to4 and
  Teredo, are refused rather than unwrapped
*/
function isGloballyRoutableAddress(address: string) {
  if (!ipaddr.isValid(address)) return false

  return ipaddr.process(address).range() === 'unicast'
}

export default isGloballyRoutableAddress
