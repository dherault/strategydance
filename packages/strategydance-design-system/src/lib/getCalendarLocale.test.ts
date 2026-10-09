import { describe, expect, it } from 'bun:test'

import { getCalendarLocale } from 'strategydance-design-system/lib/getCalendarLocale'

describe('getCalendarLocale', () => {
  it("speaks the app's locale, whatever its case", () => {
    expect(getCalendarLocale('FR').code).toBe('fr')
    expect(getCalendarLocale('zh').code).toBe('zh-CN')
    expect(getCalendarLocale('JA').code).toBe('ja')
  })

  it('speaks English for a locale it does not know, or none', () => {
    expect(getCalendarLocale('XX').code).toBe('en-US')
    expect(getCalendarLocale(undefined).code).toBe('en-US')
  })

  it("starts a French week on Monday and an English one on Sunday, as each locale's calendars do", () => {
    expect(getCalendarLocale('FR').options?.weekStartsOn).toBe(1)
    expect(getCalendarLocale('EN').options?.weekStartsOn).toBe(0)
  })
})
