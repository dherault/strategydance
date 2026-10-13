import directories from './directories.json'
import type { Directory } from './types'

export * from './enums'

export type * from './types'

export const DIRECTORIES = directories as Directory[]
