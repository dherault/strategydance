import { describe, expect, it } from 'bun:test'

import { splitSearchTerms } from './search'

describe('splitSearchTerms', () => {
  it('splits a query on whitespace of any kind and length', () => {
    expect(splitSearchTerms('pricing  strategy\tlaunch\nnow')).toEqual(['pricing', 'strategy', 'launch', 'now'])
  })

  it('leaves no empty word for whitespace around the query', () => {
    expect(splitSearchTerms('  pricing ')).toEqual(['pricing'])
    expect(splitSearchTerms('   ')).toEqual([])
    expect(splitSearchTerms('')).toEqual([])
  })

  it('splits on an ideographic space, and keeps a phrase written without spaces whole', () => {
    expect(splitSearchTerms('価格設定　相談')).toEqual(['価格設定', '相談'])
    expect(splitSearchTerms('我们应该如何定价')).toEqual(['我们应该如何定价'])
  })

  it('keeps punctuation inside a word', () => {
    expect(splitSearchTerms("l'équipe 100% sure_thing")).toEqual(["l'équipe", '100%', 'sure_thing'])
  })
})
