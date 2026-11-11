import { DirectoryStatus } from '../enums'

/*
  A directory's status as an organization's row holds it: the one it was given, or, for a row from
  before statuses, which only marked a directory in use once the company submitted to it,
  `SUBMITTED` while in use. Null is to do, a row or none
*/
export function readDirectoryStatus(
  use: { isInUse: boolean; directoryStatus?: DirectoryStatus | null } | null | undefined,
): DirectoryStatus | null {
  if (!use) return null

  return use.directoryStatus ?? (use.isInUse ? DirectoryStatus.SUBMITTED : null)
}

// Whether a directory of that status is one the company uses: submitted to, or listed there
export function isDirectoryStatusInUse(status: DirectoryStatus | null) {
  return status === DirectoryStatus.SUBMITTED || status === DirectoryStatus.LISTED
}
