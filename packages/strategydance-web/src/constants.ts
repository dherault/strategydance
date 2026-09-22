/* ---
  INTL
--- */

/*
  Every message catalogue the app can load. A message type is the basename of a file in
  `~data/intl/messages`, and the name of the JSON file each locale carries for it in
  `~data/intl/locales/<LOCALE>/`.

  Adding one means adding the source module, the entry here, and an `IntlMessagesRegistration` on
  whichever route needs it. The translation CLI reads the directory rather than this list, so the
  two can disagree: this one is what the frontend's types are built from
*/
export const MESSAGE_TYPES = [
  'global',
] as const

/* ---
  STORAGE
--- */

export const LOCAL_STORAGE_PREFIX = 'strategydance:'
