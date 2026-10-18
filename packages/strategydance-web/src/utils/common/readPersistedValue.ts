import { LOCAL_STORAGE_PREFIX } from '~constants'

const identity = (value: any) => value

/*
  What localStorage holds under a namespaced key, as `usePersistedState` keeps it, read now rather
  than when a component mounted: the default when nothing is there, the stored text does not parse,
  or there is no localStorage, as when the document shell is prerendered in Node
*/
function readPersistedValue<T>(key: string, defaultValue: T, parser: (value: any) => T = identity): T {
  if (typeof localStorage === 'undefined') return defaultValue

  try {
    const item = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${key}`)

    if (item) return parser(JSON.parse(item))
  } catch (error) {
    console.error(`Error on localStorage.getItem of ${key}`, error)
  }

  return defaultValue
}

export default readPersistedValue
