import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import replaceAll from '../src/utils/replaceAll.js';
import timeAgo from '../src/utils/timeAgo.js';
import descriptionReplace from '../src/consts/descriptionReplace.js';

const expand = text => replaceAll(text, descriptionReplace);

describe('description expansion', () => {
  it('expands NZTA abbreviations', () => {
    assert.equal(expand('West along Nth Wstn Mwy from Bond St'), 'West along North Western Motorway from Bond Street');
    assert.equal(expand('Brougham St from Durham St Sth'), 'Brougham Street from Durham Street South');
  });

  it('reads St after a name as Street, and otherwise as Saint', () => {
    assert.equal(expand('East along SH63 in St Arnaud'), 'East along SH63 in St Arnaud');
    assert.equal(expand('North along Cumberland St from St Andrew St'), 'North along Cumberland Street from St Andrew Street');
    assert.equal(expand('Hall St Overbridge'), 'Hall Street Overbridge');
    assert.equal(expand('St Heliers Bay Rd'), 'St Heliers Bay Road');
  });

  it('only replaces whole words', () => {
    assert.equal(expand('Strand Rdway'), 'Strand Rdway');
  });

  it('passes empty descriptions through', () => {
    assert.equal(expand(''), '');
    assert.equal(expand(undefined), undefined);
  });
});

describe('timeAgo', () => {
  const now = Date.UTC(2026, 9, 30, 12);
  const ago = seconds => timeAgo(now - seconds * 1000, now);

  it('is approximate, as cameras update about once a minute', () => {
    assert.equal(ago(5), 'less than a minute ago');
    assert.equal(ago(45), 'about a minute ago');
    assert.equal(ago(150), '3 minutes ago');
    assert.equal(ago(60 * 60), 'about an hour ago');
    assert.equal(ago(5 * 3600), '5 hours ago');
    assert.equal(ago(86400), '1 day ago');
  });

  it('treats times slightly in the future as just now', () => {
    assert.equal(ago(-30), 'less than a minute ago');
  });
});
