import { describe, expect, test } from 'bun:test'

import isGloballyRoutableAddress from './isGloballyRoutableAddress'

describe('isGloballyRoutableAddress', () => {
  test('lets public addresses through', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      expect(isGloballyRoutableAddress(address)).toBe(true)
    }
  })

  test('refuses every special-use range, in IPv4 and IPv6, written as either', () => {
    for (const address of [
      // Private, loopback, link-local and the metadata server, carrier-grade NAT
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '127.0.0.1',
      '127.255.255.254',
      '169.254.169.254',
      '100.64.0.1',
      // Unspecified, broadcast, multicast, documentation, benchmarking, reserved
      '0.0.0.0',
      '0.1.2.3',
      '255.255.255.255',
      '224.0.0.1',
      '192.0.2.1',
      '198.51.100.1',
      '203.0.113.1',
      '198.18.0.1',
      '240.0.0.1',
      // IPv6: unspecified, loopback, link-local, unique local, multicast, documentation, discard
      '::',
      '::1',
      'fe80::1',
      'fc00::1',
      'fd12:3456::1',
      'ff02::1',
      '2001:db8::1',
      '100::1',
      // IPv4 written as IPv6, and the gateways to IPv4
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
      '::ffff:10.0.0.1',
      '64:ff9b::7f00:1',
      '2002:7f00:1::',
      '2001::1',
    ]) {
      expect(isGloballyRoutableAddress(address)).toBe(false)
    }
  })

  test('refuses what is not an address, and reads a legacy spelling as the address it means', () => {
    for (const address of ['', 'localhost', 'metadata.google.internal', '999.1.1.1', '2130706433', '0x7f.1']) {
      expect(isGloballyRoutableAddress(address)).toBe(false)
    }
  })
})
