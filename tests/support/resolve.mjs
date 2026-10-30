// Node module resolution hook: Vite lets the client code import without file extensions
// ('../consts/congestionEnum') or a directory's index ('../consts'), which plain Node doesn't,
// so try them in turn
const EXTENSIONS = ['.js', '.jsx', '/index.js'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (!['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'].includes(err.code) || !specifier.startsWith('.')) throw err;
    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(specifier + extension, context);
      } catch { /* Try the next one */ }
    }
    throw err;
  }
}
