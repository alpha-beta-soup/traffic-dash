import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import groupCameraSites, { SITE_ICONS } from '../src/utils/groupCameraSites.js';

const camera = (id, name, direction, lat, lon, status = {}) => ({
  id, name, direction, lat, lon, offline: false, underMaintenance: false, ...status,
});

describe('groupCameraSites', () => {
  it('groups cameras within 50m into one site, named by what they share', () => {
    const sites = groupCameraSites([
      camera(1, 'SH1 Pound Rd North', 'Northbound', -43.5, 172.6),
      camera(2, 'SH1 Pound Rd South', 'Southbound', -43.5002, 172.6), // About 22m south
    ]);
    assert.equal(sites.length, 1);
    assert.equal(sites[0].name, 'SH1 Pound Rd');
    assert.equal(sites[0].cameraIds, '1,2');
  });

  it('keeps cameras further apart as separate sites', () => {
    const sites = groupCameraSites([
      camera(1, 'SH1 Churton Park North', 'Northbound', -41.2, 174.8),
      camera(2, 'SH1 Churton Park South', 'Southbound', -41.201, 174.8), // About 111m south
    ]);
    assert.equal(sites.length, 2);
  });

  it('fills a quarter per direction: working, offline or none', () => {
    const [site] = groupCameraSites([
      camera(1, 'A North', 'Northbound', -43.5, 172.6),
      camera(2, 'A South', 'Southbound', -43.5, 172.6, { offline: true }),
    ]);
    assert.equal(site.icon, 'site-w-o-'); // N working, E none, S offline, W none
  });

  it('treats maintenance and NZTA\'s stock "unavailable" image as offline', () => {
    const [site] = groupCameraSites([
      camera(1, 'B East', 'Eastbound', -43.5, 172.6, { underMaintenance: true }),
      camera(2, 'B West', 'Westbound', -43.5, 172.6, { unavailable: true }),
    ]);
    assert.equal(site.icon, 'site--o-o');
  });

  it('names a site with nothing in common after its first camera, without the direction', () => {
    const [site] = groupCameraSites([
      camera(1, 'SH76 Lincoln Rd East', 'Eastbound', -43.55, 172.6),
      camera(2, 'Lincoln Rd / Nairn St South', 'Southbound', -43.55, 172.6),
    ]);
    assert.equal(site.name, 'SH76 Lincoln Rd');
  });

  it('has an icon for every combination of quarters', () => {
    assert.equal(SITE_ICONS.length, 3 ** 4);
    assert.equal(new Set(SITE_ICONS).size, SITE_ICONS.length);
  });
});
