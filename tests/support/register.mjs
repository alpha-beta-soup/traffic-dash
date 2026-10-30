// Lets the tests import the client code in plain Node (node --test), as Vite would:
// see resolve.mjs
import { register } from 'node:module';

register('./resolve.mjs', import.meta.url);
