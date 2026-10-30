import strategicFrameworks from './strategicFrameworks.json'
import type { StrategicFramework } from './types'

export * from './constants'

export type * from './types'

// Empty until the first frameworks are written
export const STRATEGIC_FRAMEWORKS = strategicFrameworks as StrategicFramework[]
