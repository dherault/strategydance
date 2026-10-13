import { createSign } from 'node:crypto'

/*
  The JSON Web Token a GitHub App signs to ask for an installation token: RS256 with its private
  key, issued a minute in the past for a clock running behind GitHub's, and good for nine minutes,
  under GitHub's ten
*/
function createGitHubAppJwt(appId: string, privateKey: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000) - 60
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 10 * 60 - 60, iss: appId }))
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url')

  return `${header}.${payload}.${signature}`
}

function toBase64Url(text: string) {
  return Buffer.from(text).toString('base64url')
}

export default createGitHubAppJwt
