import ipaddr from 'ipaddr.js'

// The block IANA hands global unicast IPv6 addresses out of: anything outside it is not assigned
const GLOBAL_UNICAST_IPV6 = ipaddr.parseCIDR('2000::/3')

/*
  Whether an IP address is one on the public internet, the only kind this server reaches out to on
  another's behalf: an allowlist, `ipaddr.js`'s unicast range alone, so loopback, private,
  link-local (the metadata server at 169.254.169.254, which hands out the service's tokens),
  carrier-grade NAT, multicast, broadcast, unspecified, documentation and every other special-use
  range are refused, and so is an address that is not one. An IPv6 address has to sit in the global
  unicast block too, since `ipaddr.js` calls unassigned space unicast. An IPv4 address written as
  IPv6 is read as the IPv4 address it is, and IPv6's ways of reaching IPv4 through a gateway, NAT64,
  6to4 and Teredo, are refused rather than unwrapped
*/
function isGloballyRoutableAddress(address: string) {
  if (!ipaddr.isValid(address)) return false

  const parsed = ipaddr.process(address)

  if (parsed.range() !== 'unicast') return false

  return parsed.kind() === 'ipv4' || parsed.match(GLOBAL_UNICAST_IPV6)
}

export default isGloballyRoutableAddress
