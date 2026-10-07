import { cpSync, mkdirSync, rmSync } from 'node:fs';
const output = '.wellness-public';
rmSync(output, { recursive: true, force: true });
mkdirSync(`${output}/js`, { recursive: true });
cpSync('unlock', `${output}/unlock`, { recursive: true });
cpSync('js/wellness-attribution.js', `${output}/js/wellness-attribution.js`);
