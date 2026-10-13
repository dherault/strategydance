import { DirectoryBusinessModel, DirectoryInactiveReason, DirectoryType } from 'strategydance-directories'
import { z } from 'zod'

import type { DirectoryLists } from '~types'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const directorySchema = z.strictObject({
  name: z.string().min(1),
  type: z.enum(Object.values(DirectoryType)),
  rootUrl: z.url(),
  submissionUrl: z.url(),
  description: z.string(),
  businessModel: z.enum(Object.values(DirectoryBusinessModel)),
  lastChecked: z.string().regex(DAY_PATTERN).nullable(),
  unreachableSince: z.string().regex(DAY_PATTERN).nullable(),
})

const inactiveDirectorySchema = directorySchema.extend({
  inactiveReason: z.enum(Object.values(DirectoryInactiveReason)),
})

/*
  The directories package's two lists, from the text of their files. Strict: a field or a value this
  code does not know throws, since the worker runs the code of the last release on the lists of
  `dev`, which may already hold what a newer release added, and writing them back would drop it
*/
function readDirectoryLists(directoriesText: string, inactiveDirectoriesText: string): DirectoryLists {
  return {
    directories: z.array(directorySchema).parse(JSON.parse(directoriesText)),
    inactiveDirectories: z.array(inactiveDirectorySchema).parse(JSON.parse(inactiveDirectoriesText)),
  }
}

export default readDirectoryLists
