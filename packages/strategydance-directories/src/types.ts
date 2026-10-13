import type { DirectoryBusinessModel, DirectoryInactiveReason, DirectoryType } from './enums'

export type Directory = {
  name: string
  type: DirectoryType
  // The site's origin, or a Reddit community's own page, since reddit.com itself is never down
  rootUrl: string
  // Where a startup is submitted, which is the root itself when the source gave no other page
  submissionUrl: string
  description: string
  businessModel: DirectoryBusinessModel
  // When the directory was last checked, null until something checks it
  lastChecked: string | null
}

// A directory nothing can be submitted to today, kept so a later check can bring it back
export type InactiveDirectory = Directory & {
  inactiveReason: DirectoryInactiveReason
}
