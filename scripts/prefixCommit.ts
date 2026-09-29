import { execSync } from 'child_process'
import fs from 'fs'

const DEFAULT_COMMIT_PREFIX = 'root'

const COMMIT_PREFIX_TO_PATH = {
  web: 'packages/strategydance-web/',
  backend: 'packages/strategydance-backend/',
  core: 'packages/strategydance-core/',
  database: 'packages/strategydance-database/',
  translations: 'packages/strategydance-translations/',
  emails: 'packages/strategydance-emails/',
  'design-system': 'packages/strategydance-design-system/',
}

const commitMessageFile = process.argv[2]
const message = fs.readFileSync(commitMessageFile, 'utf8').trim()

const ALL_PREFIXES = [DEFAULT_COMMIT_PREFIX, ...Object.keys(COMMIT_PREFIX_TO_PATH)]

for (const pathPrefix of ALL_PREFIXES) {
  if (new RegExp(`^\\[${pathPrefix}\\]`).test(message)) process.exit(0)
}

const files = execSync('git diff --cached --name-only', { encoding: 'utf8' }).split('\n').filter(Boolean)

let prefix = DEFAULT_COMMIT_PREFIX

// An empty commit stages nothing, and every path passes `every` on an empty list
for (const [pathPrefix, path] of Object.entries(COMMIT_PREFIX_TO_PATH)) {
  if (!files.length || !files.every(f => f.startsWith(path))) continue

  prefix = pathPrefix

  break
}

fs.writeFileSync(commitMessageFile, `[${prefix}] ${message}\n`)
