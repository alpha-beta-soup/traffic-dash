// New Zealand's public holidays, as observed (a weekend holiday moved to a weekday as the law
// says), worked out from their rules: the national ones, and each region's anniversary day as
// MBIE lists it (employment.govt.nz, "Public holidays and anniversary dates"). Traffic on them is
// like a Sunday's, and some move from year to year (Easter, Matariki), so they're marked on the
// traffic count charts, and left out when comparing with a year before.

const DAY = 86_400_000;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const utc = (year, month, day) => Date.UTC(year, month - 1, day);
const weekday = ms => new Date(ms).getUTCDay(); // 0 Sunday … 6 Saturday
const isWeekend = ms => [0, 6].includes(weekday(ms));

// The nth (1st, 2nd…) `day` (0 Sunday … 6 Saturday) of a month
const nth = (year, month, day, n) => {
  const first = utc(year, month, 1);
  return first + (((day - weekday(first) + 7) % 7) + (n - 1) * 7) * DAY;
};
const MONDAY = 1;
// The Monday nearest a date (the one before, for a Tuesday to Thursday)
const nearestMonday = ms => ms + [1, 0, -1, -2, -3, 3, 2][weekday(ms)] * DAY;

// Easter Sunday (the Gregorian computus)
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = (19 * a + b - Math.floor(b / 4) - Math.floor((8 * b + 13) / 25) + 15) % 30;
  const e = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - d - (c % 4)) % 7;
  const f = d + e - 7 * Math.floor((a + 11 * d + 22 * e) / 451) + 114;
  return utc(year, Math.floor(f / 31), (f % 31) + 1);
}

// Matariki, by the Te Kāhui o Matariki Public Holiday Act 2022's schedule (to 2052; extend from it)
const MATARIKI = {
  2022: '06-24', 2023: '07-14', 2024: '06-28', 2025: '06-20', 2026: '07-10', 2027: '06-25', 2028: '07-14', 2029: '07-06', 2030: '06-21',
};

// Holidays that fall on a weekend are observed on the next weekday that isn't already one
// (Christmas on a Sunday: Boxing Day stays Monday, and Christmas is Tuesday)
function observe(holidays) {
  const taken = new Set(holidays.filter(([ms]) => !isWeekend(ms)).map(([ms]) => ms));
  return holidays.map(([ms, name]) => {
    if (!isWeekend(ms)) return [ms, name];
    let day = ms + DAY;
    while (isWeekend(day) || taken.has(day)) day += DAY;
    taken.add(day);
    return [day, name];
  });
}

// The national public holidays in a year: Map of ISO date → name
export function nationalHolidays(year) {
  const sunday = easter(year);
  return new Map([
    ...observe([[utc(year, 1, 1), "New Year's Day"], [utc(year, 1, 2), "Day after New Year's Day"]]),
    ...observe([[utc(year, 2, 6), 'Waitangi Day']]),
    [sunday - 2 * DAY, 'Good Friday'],
    [sunday + DAY, 'Easter Monday'],
    ...observe([[utc(year, 4, 25), 'Anzac Day']]),
    [nth(year, 6, MONDAY, 1), year >= 2023 ? "King's Birthday" : "Queen's Birthday"],
    ...(MATARIKI[year] ? [[Date.parse(`${year}-${MATARIKI[year]}`), 'Matariki']] : []),
    [nth(year, 10, MONDAY, 4), 'Labour Day'],
    ...observe([[utc(year, 12, 25), 'Christmas Day'], [utc(year, 12, 26), 'Boxing Day']]),
  ].map(([ms, name]) => [iso(ms), name]));
}

// Each anniversary day's observed date in a year
const ANNIVERSARIES = {
  Wellington: year => nearestMonday(utc(year, 1, 22)),
  Auckland: year => nearestMonday(utc(year, 1, 29)),
  Nelson: year => nearestMonday(utc(year, 2, 1)),
  Taranaki: year => nth(year, 3, MONDAY, 2),
  // Moved to the Tuesday after Easter if it would be Easter Monday
  Otago: (year) => {
    const day = nearestMonday(utc(year, 3, 23));
    return day === easter(year) + DAY ? day + DAY : day;
  },
  Southland: year => easter(year) + 2 * DAY, // Easter Tuesday
  'South Canterbury': year => nth(year, 9, MONDAY, 4), // Dominion Day
  "Hawke's Bay": year => nth(year, 10, MONDAY, 4) - 3 * DAY, // The Friday before Labour Day
  Marlborough: year => nth(year, 10, MONDAY, 4) + 7 * DAY, // The Monday after Labour Day
  // Show Day: the second Friday after the first Tuesday in November
  Canterbury: year => nth(year, 11, 2, 1) + 10 * DAY,
  Westland: year => nearestMonday(utc(year, 12, 1)),
};

// The anniversary day observed at a place, by NZTA's region for it ("09 - Wellington"), lat and
// lon: regions keep their old provinces' days, so Manawatū-Whanganui has Wellington's, and Waikato,
// the Bay of Plenty, Gisborne and Northland have Auckland's. NZTA's Nelson/Marlborough and
// Canterbury hold two each, split here roughly (west of the Rai Valley, north of the Rangitata);
// the whole West Coast is given Westland's, though Buller may keep another. Null if not known.
export function anniversaryOf({ region = '', lat, lon }) {
  const name = region.replace(/^\d+\s*-\s*/, '');
  if (name === 'Nelson/Marlborough') return lon < 173.5 ? 'Nelson' : 'Marlborough';
  if (name === 'Canterbury') return lat < -43.95 ? 'South Canterbury' : 'Canterbury';
  return {
    Northland: 'Auckland',
    Auckland: 'Auckland',
    Waikato: 'Auckland',
    'Bay of Plenty': 'Auckland',
    Gisborne: 'Auckland',
    'Hawkes Bay': "Hawke's Bay",
    Taranaki: 'Taranaki',
    'Manawatu-Wanganui': 'Wellington',
    Wellington: 'Wellington',
    'West Coast': 'Westland',
    Otago: 'Otago',
    Southland: 'Southland',
  }[name] ?? null;
}

// The public holidays at a place in a year, its anniversary day included: Map of ISO date → name
export function holidaysAt(place, year) {
  const holidays = nationalHolidays(year);
  const anniversary = anniversaryOf(place);
  if (anniversary) {
    const date = iso(ANNIVERSARIES[anniversary](year));
    if (!holidays.has(date)) holidays.set(date, `${anniversary} Anniversary Day`);
  }
  return holidays;
}
