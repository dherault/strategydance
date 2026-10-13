import { parseArgs } from 'node:util'

import { DIRECTORIES_FILE_PATH, INACTIVE_DIRECTORIES_FILE_PATH } from '~constants'

import createAnthropicClaudeClient from '~domain/agent/createAnthropicClaudeClient'
import checkDirectories from '~domain/directories/checkDirectories'
import { DIRECTORY_CHECK_COUNT, INACTIVE_DIRECTORY_CHECK_COUNT } from '~domain/directories/directoryCheckSettings'
import publishDirectoryCheck from '~domain/directories/publishDirectoryCheck'
import readDirectoryLists from '~domain/directories/readDirectoryLists'
import serializeDirectoryLists from '~domain/directories/serializeDirectoryLists'
import createGitHubAppToken from '~domain/github/createGitHubAppToken'
import createGitHubClient from '~domain/github/createGitHubClient'

/*
  Runs the directories' check on this checkout's lists, as the worker runs it every day on the
  repository's, and writes what it found into the two files, for a person to read and commit:

    bun run check:directories                         # as many as a day's run checks
    bun run check:directories --count 3 --inactive 0  # fewer, or more
    bun run check:directories --name "Product Hunt"   # those named, again and again if need be
    bun run check:directories --dry-run               # prints the report, writes nothing
    bun run check:directories --publish --count 2     # as the worker does, on the repository

  `--publish` reads the lists from GitHub and commits to the rolling pull request into `dev`, as the
  worker's `/internal/directories-check` does, as the GitHub App: what proves the App before a
  release takes the route to the worker. Its id and key are GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY
  when set, and the `github-app-id` and `github-app-private-key` secrets otherwise.

  Every review asks Claude, which costs money, about $0.10 a directory: the report says
  what the run cost. Claude's key is ANTHROPIC_API_KEY when set, and the `anthropic-api-key` secret
  otherwise
*/
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    count: { type: 'string', default: String(DIRECTORY_CHECK_COUNT) },
    inactive: { type: 'string', default: String(INACTIVE_DIRECTORY_CHECK_COUNT) },
    name: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    publish: { type: 'boolean', default: false },
  },
})

const count = Number(values.count)
const inactiveCount = Number(values.inactive)

if (!Number.isInteger(count) || count < 0 || !Number.isInteger(inactiveCount) || inactiveCount < 0) {
  console.error('--count and --inactive take a whole number')
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)

if (values.publish) {
  if (values.name || values['dry-run']) {
    console.error('--publish checks what a day picks, and writes it: it takes neither --name nor --dry-run')
    process.exit(1)
  }

  const { outcome, url } = await publishDirectoryCheck({
    github: createGitHubClient(await createGitHubAppToken()),
    claude: createAnthropicClaudeClient(),
    today,
    count,
    inactiveCount,
  })

  console.log(`${outcome}${url ? `: ${url}` : ''}`)
  process.exit(0)
}

const REPOSITORY_ROOT = new URL('../../../', import.meta.url)
const directoriesFile = Bun.file(new URL(DIRECTORIES_FILE_PATH, REPOSITORY_ROOT))
const inactiveDirectoriesFile = Bun.file(new URL(INACTIVE_DIRECTORIES_FILE_PATH, REPOSITORY_ROOT))
const lists = readDirectoryLists(await directoriesFile.text(), await inactiveDirectoriesFile.text())
const unknownNames = (values.name ?? []).filter(
  name => ![...lists.directories, ...lists.inactiveDirectories].some(directory => directory.name === name),
)

if (unknownNames.length) {
  console.error(`No directory is named ${unknownNames.join(', ')}`)
  process.exit(1)
}

const result = await checkDirectories(lists, {
  claude: createAnthropicClaudeClient(),
  count,
  inactiveCount,
  names: values.name,
  today,
})

console.log(result.report)

if (!values['dry-run']) {
  const { directoriesText, inactiveDirectoriesText } = serializeDirectoryLists(result.lists)

  await Bun.write(directoriesFile, directoriesText)
  await Bun.write(inactiveDirectoriesFile, inactiveDirectoriesText)
}
