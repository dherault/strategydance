// The bytes `encodeBase64` wrote. Throws on a string that is not base64
function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)

  return bytes
}

export default decodeBase64
