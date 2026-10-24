import { parseArgs } from 'node:util'

/*
  Syncs the ECB's exchange rates from Frankfurter by hand, as the worker's daily sweep does:

    bun run sync:exchange-rates                # the emulators, which need it once
    bun run sync:exchange-rates --production   # the project, with Application Default Credentials

  The first run backfills every year since 1999, in some 28 requests and 800 writes, and a run after
  it writes the year under way again, so it can stop at any point and start again. Run it once on
  the project when the release that added it deploys, or leave the next sweep to backfill.

  Without `--production` it points at the emulators itself, the Data Connect emulator on 9399 unless
  `DATA_CONNECT_EMULATOR_HOST` names another, so it never touches the project unless told to. With
  it, it reaches the project even from a shell that exports the emulator's address
*/
const { values } = parseArgs({ args: process.argv.slice(2), options: { production: { type: 'boolean' } } })

if (values.production) delete process.env.DATA_CONNECT_EMULATOR_HOST
else process.env.DATA_CONNECT_EMULATOR_HOST ??= 'localhost:9399'

// Imported once the emulator's address is set, which the Admin SDK reads as it starts
const { default: syncExchangeRates } = await import('~domain/budget/syncExchangeRates')

const { years, latestDay } = await syncExchangeRates()

console.log(
  years.length
    ? `Wrote the exchange rates of ${years.join(', ')}, up to ${latestDay}`
    : 'Wrote no exchange rates: Frankfurter has no day of the year under way yet',
)

process.exit(0)
