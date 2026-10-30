import type { StrategicFramework } from './types'

/*
  Each entry's fields, in the order the file holds them. A record rather than a list, so the
  typechecker refuses a field missing from it or one the type lacks
*/
const STRATEGIC_FRAMEWORK_FIELD_ORDER: Record<keyof StrategicFramework, true> = {
  id: true,
  name: true,
  description: true,
  whenToUse: true,
  inputs: true,
  questions: true,
  output: true,
}

export const STRATEGIC_FRAMEWORK_FIELDS = Object.keys(
  STRATEGIC_FRAMEWORK_FIELD_ORDER,
) as readonly (keyof StrategicFramework)[]
