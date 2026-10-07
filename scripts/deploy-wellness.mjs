// Deploy this separate funnel with its own Vercel configuration, preserving
// the shared Nancy bridge project's default vercel.json.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = process.cwd();
const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (project.projectName !== 'wellness-insider-lander') throw Error('Link to wellness-insider-lander before deploying.');
const directory = mkdtempSync(path.join(tmpdir(), 'wellness-guide-deploy-'));
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of files) {
  mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
  cpSync(path.join(root, file), path.join(directory, file));
}
cpSync('vercel.wellness.json', path.join(directory, 'vercel.json'));
mkdirSync(path.join(directory, '.vercel'), { recursive: true });
writeFileSync(path.join(directory, '.vercel/project.json'), JSON.stringify(project));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const result = spawnSync('vercel', ['deploy', '--yes', '--meta', `sourceCommit=${commit}`, ...process.argv.slice(2)], { cwd: directory, stdio: 'inherit' });
process.exit(result.status ?? 1);
