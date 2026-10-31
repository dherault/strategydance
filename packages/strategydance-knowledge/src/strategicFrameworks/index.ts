import strategicFrameworks from './strategicFrameworks.json'
import type { StrategicFramework } from './types'

export * from './constants'

export type * from './types'

// Written on 2026-10-31, from SWOT and Porter's Five Forces to Jobs to Be Done and the pre-mortem
export const STRATEGIC_FRAMEWORKS = strategicFrameworks as StrategicFramework[]
