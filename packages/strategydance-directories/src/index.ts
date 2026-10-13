import directories from './directories.json'
import inactiveDirectories from './inactiveDirectories.json'
import type { Directory, InactiveDirectory } from './types'

export * from './constants'
export * from './enums'

export type * from './types'

/*
  Read on 2026-10-13 from the README of mmmmingos/where-to-submit-your-startup: its directories,
  the ones only for some startups, and its Reddit communities, without its notes and its dates.
  Each business model was read from the README's notes, as `DIRECTORY_BUSINESS_MODEL_PRECEDENCE` says
*/
export const DIRECTORIES = directories as Directory[]

/*
  The sites the same README reports under "Reported submission problems", read on 2026-10-13: dead,
  parked or repurposed sites, broken or closed ways to submit, and communities closed to promotion.
  Each reason was read from the row's note, and no business model was, since nothing can be
  submitted there today
*/
export const INACTIVE_DIRECTORIES = inactiveDirectories as InactiveDirectory[]
