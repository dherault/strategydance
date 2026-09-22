import { Locale } from './enums'

/*
  Bound through a local rather than exported straight off the call.

  A capitalised export whose value is a call expression reads as a component behind a HOC to the
  dev server's Fast Refresh pass, which registers it and emits a bare `$RefreshReg$` at the end of
  the module. A page holds that global, installed by the refresh preamble; anything else
  evaluating the module does not, and throws. So the rule is the whole of the rule: no
  `export const CAPITALISED = someCall()` anywhere in this package
*/
const supportedLocales = Object.values(Locale)

export const SUPPORTED_LOCALES = supportedLocales

// The source locale. It has no catalogue of its own: its strings are the `defaultMessage`s the
// frontend bundle already carries
export const DEFAULT_LOCALE = Locale.EN
