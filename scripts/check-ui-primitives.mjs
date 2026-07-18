import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const errors = [];

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['generated', 'i18n'].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else if (/\.(?:css|ts|vue)$/u.test(entry.name)) files.push(entryPath);
  }
  return files;
}

const files = await listFiles(sourceRoot);
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const relativePath = path.relative(root, file);
  if (/\bpopover-panel\b/u.test(source)) {
    errors.push(`${relativePath} uses the legacy popover-panel class; use DropdownPanel or DropdownMenu`);
  }
  if (file.endsWith('.vue')) {
    if (/\bmenu-item(?:-danger)?\b/u.test(source)) {
      errors.push(`${relativePath} uses a legacy menu item class; use dropdown-item`);
    }
    if (/\bapp-viewport-frame\b/u.test(source)) {
      errors.push(`${relativePath} applies viewport padding directly; use ViewportFrame`);
    }
    if (/\b(?:left-4[^"\n]*right-4|right-4[^"\n]*left-4)\b/u.test(source)) {
      errors.push(`${relativePath} hard-codes floating viewport gutters; use viewport-floating-inline`);
    }
    if (/shadow-\[[^\]]+\]/u.test(source)) {
      errors.push(`${relativePath} defines an arbitrary shadow; use control/card/floating elevation tokens`);
    }
    if (relativePath.startsWith(`src${path.sep}views${path.sep}`) && !relativePath.endsWith('LoginView.vue')) {
      if (!/<RoutePageFrame\b/u.test(source)) {
        errors.push(`${relativePath} must compose its page through RoutePageFrame`);
      }
      if (/\broute-page\b|\bpage-bottom-safe\b/u.test(source)) {
        errors.push(`${relativePath} assembles route layout classes directly; use RoutePageFrame props`);
      }
      if (/app-viewport-gutter|safe-area-inset-(?:left|right)/u.test(source)) {
        errors.push(`${relativePath} calculates viewport gutters directly; use AppShell and ViewportFrame`);
      }
    }
    if (
      /class="[^"]*rounded-\[var\(--radius-outer\)\][^"]*shadow-elevated[^"]*"/u.test(source)
      || /class="[^"]*shadow-elevated[^"]*rounded-\[var\(--radius-outer\)\][^"]*"/u.test(source)
    ) {
      errors.push(`${relativePath} assembles a card surface manually; use SurfacePanel or surface-card`);
    }
  }
}

const primitives = await readFile(path.join(sourceRoot, 'styles/primitives.css'), 'utf8');
for (const requiredPrimitive of [
  '.viewport-frame',
  '.viewport-content',
  '.viewport-floating-inline',
  '.route-page-frame',
  '.route-page-frame--fill',
  '.route-page-frame--bottom-safe',
  '.surface-control',
  '.surface-card',
  '.surface-floating',
  '.surface-inset',
  '.list-surface',
  '.list-surface-row',
  '.dropdown-panel',
  '.dropdown-item',
  '.dropdown-label',
  '.control-frame',
  '.control-footer',
]) {
  if (!primitives.includes(requiredPrimitive)) {
    errors.push(`src/styles/primitives.css is missing ${requiredPrimitive}`);
  }
}
for (const elevationToken of ['--shadow-control', '--shadow-card', '--shadow-floating']) {
  if (!primitives.includes(`var(${elevationToken})`)) {
    errors.push(`src/styles/primitives.css does not use ${elevationToken}`);
  }
}

if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exit(1);
}

console.log('UI primitive check passed.');
