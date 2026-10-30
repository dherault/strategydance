import type { Directory } from './types'

// The order both lists are kept in: by name, whatever its case and accents, where a reader looks
function compareDirectoryNames(a: Pick<Directory, 'name'>, b: Pick<Directory, 'name'>) {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
}

export default compareDirectoryNames
