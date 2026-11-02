// MetService's severe weather watches and warnings, from its public CAP (Common Alerting Protocol)
// feed: https://alerts.metservice.com/cap/rss, licensed Creative Commons BY 4.0. The feed lists
// the current alerts, each linking to its CAP document, which never changes once issued (an
// update is a new alert).

import { XMLParser } from 'fast-xml-parser';

export const FEED = 'https://alerts.metservice.com/cap/rss';

// Elements that can repeat are always arrays, even when there's one; values stay as text
const ALWAYS_ARRAYS = new Set(['item', 'info', 'parameter', 'area', 'polygon']);
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: name => ALWAYS_ARRAYS.has(name),
});
const text = v => (v === undefined || v === null || v === '' ? null : String(v).trim());

// The CAP documents the feed links to
export const feedLinks = rss => (parser.parse(rss).rss?.channel?.item ?? []).map(item => text(item.link)).filter(Boolean);

// CAP polygons are "lat,lon lat,lon …"; GeoJSON wants [lon, lat]
const ring = points => points.trim().split(/\s+/).map((pair) => {
  const [lat, lon] = pair.split(',').map(Number);
  return [lon, lat];
});

// A CAP alert as { id, type, event, headline, description, instruction, severity, colour,
// colourHex, onset, expires, web, areas: [{ name, polygons: [[[lon, lat], …]] }] }. Only the
// first <info> block is read: MetService issues one, in English.
export function parseAlert(xml) {
  const alert = parser.parse(xml).alert ?? {};
  const [info = {}] = alert.info ?? [];
  const parameters = Object.fromEntries((info.parameter ?? []).map(p => [text(p.valueName), text(p.value)]));
  return {
    id: text(alert.identifier),
    type: text(alert.msgType), // Alert, Update or Cancel
    event: text(info.event),
    headline: text(info.headline),
    description: text(info.description),
    instruction: text(info.instruction),
    severity: text(info.severity),
    colour: parameters.ColourCode ?? null,
    colourHex: parameters.ColourCodeHex ?? null,
    onset: text(info.onset),
    expires: text(info.expires),
    web: text(info.web),
    areas: (info.area ?? []).map(area => ({
      name: text(area.areaDesc),
      polygons: (area.polygon ?? []).map(p => ring(String(p))).filter(r => r.length >= 4),
    })),
  };
}

// Whether an alert is in force (or yet to start) at `now`
export const isCurrent = (alert, now = Date.now()) => alert.type !== 'Cancel'
  && (!alert.expires || Date.parse(alert.expires) > now);
