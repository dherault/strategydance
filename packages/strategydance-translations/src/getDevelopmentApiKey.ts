import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'

import { API_KEY_ENVIRONMENT_VARIABLE } from './constants'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Reads the local Gemini key from this package's .env, which is gitignored
export default function getDevelopmentApiKey() {
  // No override: an ambient variable still wins over the file
  config({ path: path.resolve(dirname, '../.env'), quiet: true })

  const apiKey = process.env[API_KEY_ENVIRONMENT_VARIABLE]

  if (!apiKey) {
    throw new Error(`Missing API key. Set ${API_KEY_ENVIRONMENT_VARIABLE} in packages/strategydance-translations/.env`)
  }

  return apiKey
}
