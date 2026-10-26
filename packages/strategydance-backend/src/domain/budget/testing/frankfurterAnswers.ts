/*
  Frankfurter's real answers, fetched from `https://api.frankfurter.dev/v1/` on 2026-10-24 for every
  currency but the euro, kept to USD and JPY. A closed year is kept to the days at each of its ends,
  and a year under way is its answer as it stood on its last day here. Every year after 1999 opens on
  the last ECB day of the year before, as Frankfurter starts a series on the last day on or before
  its first date: 1999 had no rate on December 31, so 2000 opens on December 30
*/

// `1999-01-01..1999-12-31`: the ECB's first year, opening on Monday, January 4
export const FRANKFURTER_1999 = {
  amount: 1,
  base: 'EUR',
  start_date: '1999-01-04',
  end_date: '1999-12-30',
  rates: {
    '1999-01-04': { JPY: 133.73, USD: 1.1789 },
    '1999-01-05': { JPY: 130.96, USD: 1.179 },
    '1999-01-06': { JPY: 131.42, USD: 1.1743 },
    '1999-12-29': { JPY: 103.02, USD: 1.0072 },
    '1999-12-30': { JPY: 102.73, USD: 1.0046 },
  },
}

// `2000-01-01..`, on January 4, 2000
export const FRANKFURTER_2000 = {
  amount: 1,
  base: 'EUR',
  start_date: '1999-12-30',
  end_date: '2000-01-04',
  rates: {
    '1999-12-30': { JPY: 102.73, USD: 1.0046 },
    '2000-01-03': { JPY: 102.75, USD: 1.009 },
    '2000-01-04': { JPY: 105.88, USD: 1.0305 },
  },
}

// `2025-01-01..2025-12-31`
export const FRANKFURTER_2025 = {
  amount: 1,
  base: 'EUR',
  start_date: '2024-12-31',
  end_date: '2025-12-31',
  rates: {
    '2024-12-31': { JPY: 163.06, USD: 1.0389 },
    '2025-01-02': { JPY: 162.04, USD: 1.0321 },
    '2025-12-30': { JPY: 183.48, USD: 1.1757 },
    '2025-12-31': { JPY: 184.09, USD: 1.175 },
  },
}

// `2026-01-01..`, on January 2, 2026
export const FRANKFURTER_2026 = {
  amount: 1,
  base: 'EUR',
  start_date: '2025-12-31',
  end_date: '2026-01-02',
  rates: {
    '2025-12-31': { JPY: 184.09, USD: 1.175 },
    '2026-01-02': { JPY: 183.94, USD: 1.1721 },
  },
}
