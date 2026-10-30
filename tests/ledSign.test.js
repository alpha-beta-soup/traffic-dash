import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { signPages, signSize } from '../src/utils/ledSign.js';
import { glyph } from '../src/consts/ledFont.js';

// Messages arrive from the server with the sign markup already turned into text:
// [nl] -> newline, [np] -> blank line (new page), [jl4] -> tab (right-justify what follows)
describe('signPages', () => {
  it('splits pages and lines, and uppercases', () => {
    assert.deepEqual(signPages('Clearway\nnot operating\n\nAll vehicles\nkeep right'), [
      [{ left: 'CLEARWAY', right: '' }, { left: 'NOT OPERATING', right: '' }],
      [{ left: 'ALL VEHICLES', right: '' }, { left: 'KEEP RIGHT', right: '' }],
    ]);
  });

  it('keeps travel times right-justified', () => {
    assert.deepEqual(signPages("J'VILLE \t13\nPORIRUA \t18"), [
      [{ left: "J'VILLE", right: '13' }, { left: 'PORIRUA', right: '18' }],
    ]);
  });

  it('drops empty pages', () => {
    assert.deepEqual(signPages('TRAVEL TIMES\n\n\n\nBEALEY AVE\t11'), [
      [{ left: 'TRAVEL TIMES', right: '' }],
      [{ left: 'BEALEY AVE', right: '11' }],
    ]);
    assert.deepEqual(signPages(' \n\n '), []);
  });

  it('limits lines to 24 characters, like the signs', () => {
    const [[line]] = signPages('A'.repeat(30));
    assert.equal(line.left.length, 24);
  });
});

describe('signSize', () => {
  it('fits the longest line and most lines across all pages', () => {
    const pages = signPages('WGTN CBD VIA\nSH1\t21\nTHE BAYS\t22\n\nDRIVE SAFELY');
    // The longest line is "WGTN CBD VIA" (12); "THE BAYS", a space and "22" make 11
    assert.deepEqual(signSize(pages), { columns: 12, rows: 3 });
  });
});

describe('ledFont', () => {
  it('has a 5×7 glyph for every character, blank for unknown ones', () => {
    for (const char of "ABCXYZ0189 -.,'/:()&?!+=<>%\"") {
      const rows = glyph(char);
      assert.equal(rows.length, 7, char);
      rows.forEach(row => assert.equal(row.length, 5, char));
    }
    assert.ok(glyph('~').flat().every(dot => !dot));
  });
});
