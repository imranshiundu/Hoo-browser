#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const checks = [
  {
    name: 'Owl wallpaper exists',
    path: 'src/renderer/assets/branding/hoo-owl-wallpaper.png',
    required: false,
    test: (file) => fs.existsSync(file) && fs.statSync(file).size > 1024,
    help: 'Add your owl wallpaper at src/renderer/assets/branding/hoo-owl-wallpaper.png.'
  },
  {
    name: 'Stability hotfix script exists',
    path: 'scripts/apply-hoo-stability-hotfix.cjs',
    required: true,
    test: (file) => fs.existsSync(file),
    help: 'Pull latest main.'
  },
  {
    name: 'Main process exists',
    path: 'src/main/main.ts',
    required: true,
    test: (file) => fs.existsSync(file),
    help: 'Run from the Hoo-browser repository root.'
  },
  {
    name: 'Privacy filters include external protocol guard',
    path: 'src/main/privacy-filters.ts',
    required: true,
    test: (file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('isExternalProtocol'),
    help: 'Pull latest main or restore src/main/privacy-filters.ts.'
  },
  {
    name: 'Main process has shell external support',
    path: 'src/main/main.ts',
    required: false,
    test: (file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('shell') && fs.readFileSync(file, 'utf8').includes('isExternalProtocol'),
    help: 'Run npm run hotfix:stability to apply the local main.ts patch.'
  },
  {
    name: 'Main process ignores subframe load failures',
    path: 'src/main/main.ts',
    required: false,
    test: (file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('if (!isMainFrame) return'),
    help: 'Run npm run hotfix:stability to prevent blocked ad frames from becoming full error pages.'
  }
];

let failedRequired = false;
let softWarnings = 0;

console.log('Hoo local verification\n');
for (const check of checks) {
  const file = path.join(root, check.path);
  const ok = Boolean(check.test(file));
  const marker = ok ? '✓' : check.required ? '✗' : '!';
  console.log(`${marker} ${check.name}`);
  if (!ok) {
    console.log(`  ${check.help}`);
    if (check.required) failedRequired = true;
    else softWarnings += 1;
  }
}

console.log('');
if (failedRequired) {
  console.error('Required Hoo checks failed. Fix them before building.');
  process.exit(1);
}
if (softWarnings > 0) {
  console.warn(`${softWarnings} optional/stability checks need attention.`);
  console.warn('Recommended: npm run hotfix:stability && npm run verify:hoo');
  process.exit(0);
}
console.log('Hoo local checks look good.');
