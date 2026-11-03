// Node module hooks: Vite lets the client code import without file extensions
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

// Vite also imports JSON without `with { type: 'json' }`, which plain Node requires: load it as a
// module that exports the data
export async function load(url, context, nextLoad) {
  if (!url.endsWith('.json') || context.importAttributes?.type === 'json') return nextLoad(url, context);
  const { source } = await nextLoad(url, { ...context, format: 'json', importAttributes: { type: 'json' } });
  return { format: 'module', source: `export default ${source};`, shortCircuit: true };
}
