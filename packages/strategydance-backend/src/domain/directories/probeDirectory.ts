import type { Directory } from 'strategydance-knowledge'

import type { DirectoryProbe } from '~types'

import fetchOutbound from '~utils/fetchOutbound'

import probeDirectoryPage from '~domain/directories/probeDirectoryPage'

// A directory's root and its submission page, the second left out when it is the root itself
async function probeDirectory(directory: Directory, fetch = fetchOutbound): Promise<DirectoryProbe> {
  const [root, submission] = await Promise.all([
    probeDirectoryPage(directory.rootUrl, fetch),
    directory.submissionUrl === directory.rootUrl ? null : probeDirectoryPage(directory.submissionUrl, fetch),
  ])

  return { root, submission }
}

export default probeDirectory
