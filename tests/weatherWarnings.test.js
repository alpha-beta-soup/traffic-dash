import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { feedLinks, isCurrent, parseAlert } from '../server/weatherWarnings.js';

const RSS = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"><channel>
  <title>Metservice Public CAP Alerts</title>
  <item><title>Heavy Rain Watch</title><link>https://alerts.metservice.com/cap/alert?id=a.1</link></item>
  <item><title>Strong Wind Warning</title><link>https://alerts.metservice.com/cap/alert?id=b.2</link></item>
</channel></rss>`;

const CAP = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
<identifier>a.1</identifier><msgType>Update</msgType>
<info><event>wind</event><severity>Moderate</severity>
<onset>2026-11-03T09:00:00+13:00</onset><expires>2026-11-04T15:00:00+13:00</expires>
<headline>Strong Wind Warning</headline><description>Severe gales gusting 120 km/h in exposed places &amp; about the coast.</description>
<instruction>Action: Be prepared.</instruction><web>https://metservice.com/warnings/home</web>
<parameter><valueName>ColourCode</valueName><value>Orange</value></parameter>
<parameter><valueName>ColourCodeHex</valueName><value>#FFA500</value></parameter>
<area><areaDesc>Wellington</areaDesc><polygon>-41.1,174.7 -41.1,174.9 -41.3,174.9 -41.3,174.7 -41.1,174.7</polygon></area>
</info></alert>`;

describe('weather warnings', () => {
  it('lists the alerts the feed links to', () => {
    assert.deepEqual(feedLinks(RSS), ['https://alerts.metservice.com/cap/alert?id=a.1', 'https://alerts.metservice.com/cap/alert?id=b.2']);
  });

  it('reads a CAP alert', () => {
    const alert = parseAlert(CAP);
    assert.equal(alert.id, 'a.1');
    assert.equal(alert.type, 'Update');
    assert.equal(alert.event, 'wind');
    assert.equal(alert.headline, 'Strong Wind Warning');
    assert.equal(alert.description, 'Severe gales gusting 120 km/h in exposed places & about the coast.');
    assert.equal(alert.colour, 'Orange');
    assert.equal(alert.colourHex, '#FFA500');
    assert.equal(alert.expires, '2026-11-04T15:00:00+13:00');
  });

  it('turns polygons into GeoJSON rings', () => {
    const [area] = parseAlert(CAP).areas;
    assert.equal(area.name, 'Wellington');
    assert.deepEqual(area.polygons[0][0], [174.7, -41.1]);
    assert.equal(area.polygons[0].length, 5);
  });

  it('copes with comments and empty elements', () => {
    const alert = parseAlert(CAP
      .replace('<headline>', '<!-- <headline>Not this</headline> --><headline>')
      .replace('<instruction>Action: Be prepared.</instruction>', '<instruction/>')
      .replace('</area>', '</area><area><areaDesc>Nowhere</areaDesc></area>'));
    assert.equal(alert.headline, 'Strong Wind Warning');
    assert.equal(alert.instruction, null);
    assert.deepEqual(alert.areas.map(area => area.polygons.length), [1, 0]);
  });

  it('keeps alerts until they expire or are cancelled', () => {
    const alert = parseAlert(CAP);
    assert.equal(isCurrent(alert, Date.parse('2026-11-04T12:00:00+13:00')), true);
    assert.equal(isCurrent(alert, Date.parse('2026-11-04T16:00:00+13:00')), false);
    assert.equal(isCurrent({ ...alert, type: 'Cancel' }, Date.parse('2026-11-04T12:00:00+13:00')), false);
  });
});
