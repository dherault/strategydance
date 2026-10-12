import Anthropic from '@anthropic-ai/sdk'

import { SECRET_ANTHROPIC_API_KEY } from '~constants'

import retrieveSecret from '~utils/retrieveSecret'

let client: Promise<Anthropic> | null = null

/*
  The process's client for Anthropic's API, which runs' requests and the Files API share. Its key is
  `ANTHROPIC_API_KEY` when set, as on a machine whose credentials cannot read the secret, and the
  `anthropic-api-key` secret otherwise, read once per process and again only after a read that failed
*/
function getAnthropicClient() {
  if (!client) {
    client = (async () =>
      new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || (await retrieveSecret(SECRET_ANTHROPIC_API_KEY)) }))()

    client.catch(() => {
      client = null
    })
  }

  return client
}

export default getAnthropicClient
