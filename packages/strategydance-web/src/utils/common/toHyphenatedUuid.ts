/*
  A UUID in its hyphenated form, 8-4-4-4-12, whichever form it came in, as Data Connect writes one
  without its hyphens. An id the app writes into its own address takes this form: the router parses
  each value of the query as JSON first, so 32 hex digits that happen to be all decimal, or decimal
  around one `e`, would arrive as a number that lost its digits, where a hyphenated id never parses
*/
function toHyphenatedUuid(uuid: string) {
  const digits = uuid.replaceAll('-', '').toLowerCase()

  return [digits.slice(0, 8), digits.slice(8, 12), digits.slice(12, 16), digits.slice(16, 20), digits.slice(20)].join(
    '-',
  )
}

export default toHyphenatedUuid
