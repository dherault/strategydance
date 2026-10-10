/*
  Parts of the messages the Knowledge module's operations give when one of their checks refuses,
  which the domain matches to say why: change each with its check in the backend connector
*/
export const FULL_REFUSAL = 'An organization keeps at most'
export const SEEDED_REFUSAL = 'seeded or changed elsewhere since it was read'
export const FOLDED_REFUSAL = 'The document was folded, deleted or closed to agents since it was read'
export const EDITED_REFUSAL = 'The document was edited since it was read'
export const EMPTY_REFUSAL = 'A document keeps a title or some text'
