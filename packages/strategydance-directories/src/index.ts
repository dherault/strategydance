import directories from './directories.json'
import type { Directory } from './types'

export * from './enums'

export type * from './types'

/*
  Read on 2026-10-13 from the README of mmmmingos/where-to-submit-your-startup: its directories,
  the ones only for some startups, and its Reddit communities, without its notes and its dates. The sites it reports dead or closed to promotion are left out.
  Each business model was read from the README's notes, as `DirectoryBusinessModel` says
*/
export const DIRECTORIES = directories as Directory[]
