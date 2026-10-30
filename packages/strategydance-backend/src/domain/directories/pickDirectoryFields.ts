import {
  DIRECTORY_FIELDS,
  type Directory,
  INACTIVE_DIRECTORY_FIELDS,
  type InactiveDirectory,
} from 'strategydance-knowledge'

// An entry's own fields, in the order its file holds them, without whatever else the object carries
function pickDirectoryFields(directory: Directory): Directory {
  return pick(directory, DIRECTORY_FIELDS)
}

export function pickInactiveDirectoryFields(directory: InactiveDirectory): InactiveDirectory {
  return pick(directory, INACTIVE_DIRECTORY_FIELDS)
}

function pick<T>(entry: T, fields: readonly (keyof T)[]) {
  return Object.fromEntries(fields.map(field => [field, entry[field]])) as T
}

export default pickDirectoryFields
