import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { parse as parseVueSfc } from '@vue/compiler-sfc';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const catalogPaths = {
  en: path.join(sourceRoot, 'i18n/messages/en.ts'),
  zhTW: path.join(sourceRoot, 'i18n/messages/zh-TW.ts'),
};

function readCatalog(sourceText, variableName, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const messages = new Map();
  const duplicateKeys = [];

  function visit(node) {
    const initializer = node.initializer && ts.isAsExpression(node.initializer)
      ? node.initializer.expression
      : node.initializer;
    if (
      ts.isVariableDeclaration(node)
      && node.name.getText(sourceFile) === variableName
      && initializer
      && ts.isObjectLiteralExpression(initializer)
    ) {
      for (const property of initializer.properties) {
        if (
          !ts.isPropertyAssignment(property)
          || !ts.isStringLiteralLike(property.name)
          || !ts.isStringLiteralLike(property.initializer)
        ) continue;
        if (messages.has(property.name.text)) duplicateKeys.push(property.name.text);
        messages.set(property.name.text, property.initializer.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { duplicateKeys, messages };
}

async function listSourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['generated', 'i18n'].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listSourceFiles(entryPath));
    else if (/\.(?:ts|vue)$/u.test(entry.name)) files.push(entryPath);
  }
  return files;
}

function stripNonRuntimeText(source) {
  return source
    .replace(/<style\b[\s\S]*?<\/style>/giu, '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

const [zhSource, enSource, sourceFiles, issueCategoryConfigSource, rateLimitConfigSource] = await Promise.all([
  readFile(catalogPaths.zhTW, 'utf8'),
  readFile(catalogPaths.en, 'utf8'),
  listSourceFiles(sourceRoot),
  readFile(path.join(root, 'config/issue-categories.config.json'), 'utf8'),
  readFile(path.join(root, 'config/rate-limits.config.json'), 'utf8'),
]);
sourceFiles.push(path.join(root, 'index.html'), path.join(root, 'vite.config.ts'));
const zh = readCatalog(zhSource, 'zhTW', catalogPaths.zhTW);
const en = readCatalog(enSource, 'en', catalogPaths.en);
const errors = [];
const issueCategoryConfig = JSON.parse(issueCategoryConfigSource);
const rateLimitConfig = JSON.parse(rateLimitConfigSource);
const allowedStaticTemplateText = new Set([
  'Novae',
]);
const userFacingStaticAttributes = new Set([
  'action-label',
  'alt',
  'aria-label',
  'busy-label',
  'cancel-label',
  'caption',
  'confirm-label',
  'delete-label',
  'description',
  'editor-label',
  'editor-placeholder',
  'empty-label',
  'error-title',
  'label',
  'list-label',
  'loading-label',
  'location-label',
  'location-placeholder',
  'max-images-label',
  'message',
  'placeholder',
  'result-description',
  'result-label',
  'result-placeholder',
  'result-title',
  'select-title',
  'status-label',
  'submit-label',
  'title',
  'title-label',
  'title-placeholder',
]);

function isLocaleKey(value) {
  return zh.messages.has(value);
}

function checkVueTemplate(source, relativePath) {
  const { descriptor, errors: parseErrors } = parseVueSfc(source, { filename: relativePath });
  if (parseErrors.length) {
    errors.push(`${relativePath} could not be parsed while checking localized template text`);
    return;
  }
  const rootNode = descriptor.template?.ast;
  if (!rootNode) return;

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 2) {
      const visibleText = node.content.trim();
      if (
        /\p{L}/u.test(visibleText)
        && !allowedStaticTemplateText.has(visibleText)
      ) {
        errors.push(`${relativePath}:${node.loc.start.line} contains static visible template text: ${visibleText}`);
      }
    }
    if (node.type === 1) {
      for (const property of node.props ?? []) {
        if (
          property.type !== 6
          || !userFacingStaticAttributes.has(property.name)
          || !property.value
        ) continue;
        const value = property.value.content.trim();
        if (value && !isLocaleKey(value)) {
          errors.push(
            `${relativePath}:${property.loc.start.line} contains a static user-facing attribute `
            + `${property.name}="${value}"`,
          );
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
    for (const branch of node.branches ?? []) visit(branch);
  }

  visit(rootNode);
}

for (const [locale, catalog] of [['zh-TW', zh], ['en', en]]) {
  for (const key of catalog.duplicateKeys) errors.push(`${locale} has duplicate key: ${key}`);
  for (const [key, value] of catalog.messages) {
    if (!/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/u.test(key)) {
      errors.push(`${locale} has a non-semantic or invalid key: ${key}`);
    }
    if (/^text\.[0-9a-f]{8,}$/u.test(key)) {
      errors.push(`${locale} still has an opaque generated key: ${key}`);
    }
    if (!value.trim()) errors.push(`${locale} has an empty message: ${key}`);
  }
}
for (const key of zh.messages.keys()) {
  if (!en.messages.has(key)) errors.push(`English catalog is missing: ${key}`);
}
for (const key of en.messages.keys()) {
  if (!zh.messages.has(key)) errors.push(`Traditional Chinese catalog is missing: ${key}`);
}
for (const [key, value] of en.messages) {
  if (/\p{Script=Han}/u.test(value)) errors.push(`English message still contains Han characters: ${key}`);
  if (!value.trimStart().startsWith('{') && /^[\s"'“‘([\-—]*[a-z]/u.test(value)) {
    errors.push(`English message must start with a capital letter: ${key}`);
  }
}
for (const category of issueCategoryConfig.categories ?? []) {
  if (typeof category.labelKey !== 'string' || !zh.messages.has(category.labelKey)) {
    errors.push(`Issue category is missing a valid locale labelKey: ${String(category.id ?? '')}`);
  }
}

const localizedSourceMessages = new Set(zh.messages.values());
function checkConfigMessages(value, sourcePath) {
  if (typeof value === 'string') {
    if (/\p{Script=Han}/u.test(value) && !localizedSourceMessages.has(value)) {
      errors.push(`${sourcePath} contains a user-facing message missing from the locale catalogs: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkConfigMessages(item, `${sourcePath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, item]) => checkConfigMessages(item, `${sourcePath}.${key}`));
}
checkConfigMessages(rateLimitConfig, 'config/rate-limits.config.json');
for (const [key, zhValue] of zh.messages) {
  const enValue = en.messages.get(key);
  if (enValue === undefined) continue;
  const zhParams = [...zhValue.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
  const enParams = [...enValue.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
  if (zhParams.join('\0') !== enParams.join('\0')) {
    errors.push(`Locale interpolation parameters do not match: ${key}`);
  }
}

const usedLocaleKeys = new Set();
const directlyTranslatedKeys = new Set();
const localeNamespaces = [...new Set([...zh.messages.keys()].map((key) => key.split('.')[0]))];
const escapedNamespaces = localeNamespaces.map((namespace) => namespace.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));
const localeReferencePattern = new RegExp(
  `(['"])((?:${escapedNamespaces.join('|')})\\.[a-z][A-Za-z0-9]*(?:\\.[a-z][A-Za-z0-9]*)*)\\1`,
  'gu',
);
const nativeTags = /<(?:a|article|button|div|form|img|input|main|nav|p|section|span|textarea)\b[\s\S]*?>/giu;
const localizedPropertyPattern = /\b(?:caption|description|detail|label|message|shortLabel|statusLabel|subtitle|title)\s*:\s*(['"])([^'"]+)\1/gu;
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  const runtimeSource = stripNonRuntimeText(source);
  const relativePath = path.relative(root, file);
  if (file.endsWith('.vue')) checkVueTemplate(source, relativePath);

  for (const match of runtimeSource.matchAll(localeReferencePattern)) {
    if (isLocaleKey(match[2])) usedLocaleKeys.add(match[2]);
  }
  for (const match of runtimeSource.matchAll(/\bt\(\s*(['"])([^'"]+)\1/gu)) {
    directlyTranslatedKeys.add(match[2]);
  }
  for (const match of runtimeSource.matchAll(localizedPropertyPattern)) {
    if (!isLocaleKey(match[2]) && !allowedStaticTemplateText.has(match[2])) {
      errors.push(`${relativePath} contains a static user-facing object property: ${match[2]}`);
    }
  }
  if (/\p{Script=Han}/u.test(runtimeSource)) {
    errors.push(`${relativePath} contains a hard-coded Han string outside the locale catalogs`);
  }
  for (const tag of runtimeSource.matchAll(nativeTags)) {
    for (const attribute of tag[0].matchAll(/(?:aria-label|alt|placeholder|title)=(['"])([^'"]+)\1/gu)) {
      if (isLocaleKey(attribute[2])) {
        errors.push(`${relativePath} exposes a locale key through a native element attribute`);
      }
    }
    for (const attribute of tag[0].matchAll(/:(?:aria-label|alt|placeholder|title)=(['"])([\s\S]*?)\1/gu)) {
      const localeKeys = [...attribute[2].matchAll(localeReferencePattern)].map((match) => match[2]);
      if (localeKeys.some(isLocaleKey) && !/\bt\(/u.test(attribute[2])) {
        errors.push(`${relativePath} exposes an untranslated locale key through a bound native attribute`);
      }
    }
  }
  for (const interpolation of runtimeSource.matchAll(/\{\{[\s\S]*?\}\}/gu)) {
    const localeKeys = [...interpolation[0].matchAll(localeReferencePattern)].map((match) => match[2]);
    if (localeKeys.some(isLocaleKey) && !/\bt\(/u.test(interpolation[0])) {
      errors.push(`${relativePath} renders a locale key without t(...)`);
    }
  }
}

for (const key of usedLocaleKeys) {
  if (!zh.messages.has(key)) errors.push(`Referenced locale key is missing from both catalogs: ${key}`);
}
for (const key of directlyTranslatedKeys) {
  if (!zh.messages.has(key)) errors.push(`t(...) references a missing locale key: ${key}`);
}

if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exit(1);
}

console.log(
  `i18n check passed: ${zh.messages.size} messages, `
  + `${usedLocaleKeys.size} semantic and ${directlyTranslatedKeys.size} direct references.`,
);
