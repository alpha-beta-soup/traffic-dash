// NZTA counts vehicles in two classes, by length: heavy (trucks, buses) and light (the rest).
// Each class's count on a day of a site's series ({ total, heavy, lastYear, lastYearHeavy }),
// this year's and the year before's (null if not counted), as compared on the server and charted
// in the browser.
const minus = (a, b) => (a === null || b === null ? null : a - b);
export const VEHICLES = {
  all: [d => d.total, d => d.lastYear],
  heavy: [d => d.heavy, d => d.lastYearHeavy],
  light: [d => minus(d.total, d.heavy), d => minus(d.lastYear, d.lastYearHeavy)],
};
