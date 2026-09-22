/*
  Product background shared by every translation prompt, so the model knows what it is translating
  for.

  This is a placeholder: the repository describes itself only as "An AI experiment", and there is
  no product surface to summarise yet. Fill it in before the first real translation run. Vague
  context does not break a translation, but it is what decides the register a locale settles into,
  and the lock file means a string translated under bad context is not revisited on its own
*/
export const PRODUCT_CONTEXT = `Strategy Dance is a web application.
It is an early-stage project and its user interface is still small.`

/*
  Domain vocabulary, so product nouns are translated consistently across the UI. One bullet per
  concept, in the shape "- Xs are ...".

  Empty until there is a domain model. `translateMessages` omits the whole section while it is,
  rather than sending the model an empty heading
*/
export const KEY_CONCEPTS = ''

// The model reaches for dashes in every language, and they are the clearest tell that a text was
// machine-written. Every locale we ship inherits whatever the prompts let through
export const PUNCTUATION_RULES = `Never use an em dash ("—") or an en dash ("–") as punctuation.
Use a comma, a colon, a full stop, or parentheses instead, whichever is the most natural in the target language.
This holds for Chinese and Japanese too: do not use "——" or "—", use the reading comma or a full stop.
An en dash between two numbers, as in a range like "2020–2024", is the one exception and stays as it is.`
