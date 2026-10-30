import {
  KNOWLEDGE_ID_PATTERN,
  DirectoryBusinessModel,
  DirectoryCategory,
  DirectoryInactiveReason,
  DirectoryType,
} from 'strategydance-knowledge'
import { z } from 'zod'

import type { DirectoryLists } from '~types'

// A real day, so a date such as 2026-99-99 never reaches what counts the days since it
const daySchema = z.iso.date()

const directorySchema = z.strictObject({
  id: z.string().regex(KNOWLEDGE_ID_PATTERN),
  name: z.string().min(1),
  type: z.enum(Object.values(DirectoryType)),
  rootUrl: z.url(),
  submissionUrl: z.url(),
  description: z.string(),
  categories: z.array(z.enum(Object.values(DirectoryCategory))),
  businessModel: z.enum(Object.values(DirectoryBusinessModel)),
  lastChecked: daySchema.nullable(),
  unreachableSince: daySchema.nullable(),
})

const inactiveDirectorySchema = directorySchema.extend({
  inactiveReason: z.enum(Object.values(DirectoryInactiveReason)),
})

/*
  The knowledge package's two directory lists, from the text of their files. Strict: a field or a value this
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
