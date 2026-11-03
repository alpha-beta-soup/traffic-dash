import { useEffect, useState } from 'react';

import { fetchJson } from '../utils';

// The vehicles counted in a camera's frames over the last `hours` (server/vehicles.js):
// [{ time, count }], oldest first. Fetched again when `refreshKey` changes (e.g. each new
// frame); empty if counting is off.
export default function useVehicleCounts(id, enabled, hours, refreshKey) {
  const [counts, setCounts] = useState([]);
  const [countsId, setCountsId] = useState(id);
  if (countsId !== id) { // Another camera: none of these counts are its
    setCountsId(id);
    setCounts([]);
  }
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    fetchJson(`/api/cameras/${id}/vehicles?hours=${hours}`)
      .then(data => current && setCounts(data))
      .catch(console.error);
    return () => { current = false; };
  }, [id, enabled, hours, refreshKey]);
  return counts;
}
