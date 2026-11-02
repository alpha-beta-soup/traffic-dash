// The app's pages: the dashboard at /, and a page per camera at /camera/<id>

// { page: 'camera', id } or { page: 'dashboard' }
export function matchRoute(path) {
  const camera = /^\/camera\/(\d+)\/?$/.exec(path);
  return camera ? { page: 'camera', id: Number(camera[1]) } : { page: 'dashboard' };
}

export const cameraPath = id => `/camera/${id}`;
