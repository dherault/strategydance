import type { DirectoryBusinessModel, DirectoryCategory, DirectoryInactiveReason, DirectoryType } from './enums'

export type Directory = {
  // A slug of the name the entry was first given, which never changes, even when the name does, so
  // whatever refers to a directory keeps finding it
  id: string
  name: string
  type: DirectoryType
  // The site's origin, or a Reddit community's own page, since reddit.com itself is never down
  rootUrl: string
  // Where a startup is submitted, which is the root itself when the source gave no other page
  submissionUrl: string
  description: string
  // The kinds of product it lists, in the order `DirectoryCategory` gives them, empty until a check
  // has read them
  categories: DirectoryCategory[]
  businessModel: DirectoryBusinessModel
  // The UTC day (YYYY-MM-DD) the directory was last checked, whatever came of it, null until
  // something checks it
  lastChecked: string | null
  // The UTC day of the first of the checks in a row that could not reach the site, null once one
  // reaches it: a site is only taken for gone when a later check still cannot
  unreachableSince: string | null
}

// A directory nothing can be submitted to today, kept so a later check can bring it back
export type InactiveDirectory = Directory & {
  inactiveReason: DirectoryInactiveReason
}
