// What an entry's id is made of, whatever its kind: lowercase letters and digits, in words joined by
// single dashes
export const KNOWLEDGE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// The longest description of a framework or a tactic, in characters: one sentence, as a list of
// them shows it
export const MAX_KNOWLEDGE_DESCRIPTION_LENGTH = 200
