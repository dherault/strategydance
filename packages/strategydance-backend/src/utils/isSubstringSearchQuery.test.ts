import { describe, expect, test } from 'bun:test'

import isSubstringSearchQuery from './isSubstringSearchQuery'

describe('isSubstringSearchQuery', () => {
  test('matches Chinese and Japanese, alone or among other words', () => {
    expect(isSubstringSearchQuery('定价')).toBe(true)
    expect(isSubstringSearchQuery('価格設定')).toBe(true)
    expect(isSubstringSearchQuery('ひらがな')).toBe(true)
    expect(isSubstringSearchQuery('カタカナ')).toBe(true)
    expect(isSubstringSearchQuery('launch 定价')).toBe(true)
  })

  test('leaves the languages written with spaces to the indexes, Korean included', () => {
    expect(isSubstringSearchQuery('pricing strategy')).toBe(false)
    expect(isSubstringSearchQuery("l'équipe été")).toBe(false)
    expect(isSubstringSearchQuery('Preisgestaltung für Größe')).toBe(false)
    expect(isSubstringSearchQuery('가격 전략')).toBe(false)
  })
})
