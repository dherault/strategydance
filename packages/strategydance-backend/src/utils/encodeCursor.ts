/*
  A cursor a tool hands an agent to carry on from, opaque to it: what the next page starts from, as
  JSON in base64url, which `decodeCursor` reads back
*/
function encodeCursor(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export default encodeCursor
