/**
 * Страж структуры экранов, тот же класс защиты, что во фронтенде ТАКТ.
 *
 * Страница и layout держат не больше 15 строк import. Внутренние файлы
 * пакета (имя с «_») снаружи не импортируются: страница берёт публичный
 * вход пакета. Старых страниц сверх лимита здесь нет, поэтому списки
 * исключений не заведены.
 *
 * Запуск: `node scripts/check-import-budget.mjs` из корня проекта.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

/** Потолок строк import на странице и layout. */
export const DEFAULT_MAX_IMPORTS = 15;

const PAGE_NAMES = new Set(['+page.svelte', '+layout.svelte']);
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

/**
 * Пропусти файл в проверке внутренних импортов.
 *
 * @param {string} fileName имя файла
 * @returns {boolean} true, если файл не проверяется
 */
export function isDeepBanExcludedFile(fileName) {
  return fileName.endsWith('.test.ts') || fileName.endsWith('.test.svelte');
}

/**
 * Посчитай строки верхнего import.
 *
 * @param {string} source текст файла
 * @returns {number} число таких строк
 */
export function countTopLevelImports(source) {
  let count = 0;
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*import\s/.test(line)) count += 1;
  }
  return count;
}

/**
 * Собери строки import и export-from.
 *
 * @param {string} source текст файла
 * @returns {string[]} строки импорта
 */
export function extractImportExportLines(source) {
  /** @type {string[]} */
  const lines = [];
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*import\s/.test(line)) {
      lines.push(line);
      continue;
    }
    if (/^\s*export\s/.test(line) && /\bfrom\s+['"]/.test(line)) lines.push(line);
  }
  return lines;
}

/**
 * Достань путь модуля из строки импорта.
 *
 * @param {string} line строка исходника
 * @returns {string | null} путь модуля
 */
export function extractSpecFromLine(line) {
  const fromMatch = line.match(/\bfrom\s+['"]([^'"]+)['"]/);
  if (fromMatch) return fromMatch[1] ?? null;
  const side = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
  return side?.[1] ?? null;
}

/**
 * Найди литералы в import().
 *
 * @param {string} source текст файла
 * @returns {string[]} пути модулей
 */
export function findDynamicImportSpecs(source) {
  /** @type {string[]} */
  const found = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.trimStart().startsWith('//')) continue;
    const re = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match = re.exec(line);
    while (match !== null) {
      if (match[1]) found.push(match[1]);
      match = re.exec(line);
    }
  }
  return found;
}

/**
 * Проверь, что путь $lib заходит во внутренний файл.
 *
 * @param {string} spec путь модуля
 * @returns {boolean} true, если сегмент начинается с «_»
 */
export function isDeepInternalSpec(spec) {
  if (!spec.startsWith('$lib/')) return false;
  return spec
    .slice('$lib/'.length)
    .split('/')
    .some((segment) => segment.startsWith('_'));
}

/**
 * Переведи относительный или $lib-импорт в путь внутри src/lib.
 *
 * @param {string} fromFileRel путь файла от корня проекта
 * @param {string} spec путь модуля
 * @param {string} [projectRoot] корень проекта
 * @returns {string | null} путь относительно src/lib
 */
export function resolveUnderLib(fromFileRel, spec, projectRoot = PROJECT_ROOT) {
  const libRoot = path.join(projectRoot, 'src', 'lib');
  let absolute;
  if (spec.startsWith('$lib/')) {
    absolute = path.normalize(path.join(libRoot, ...spec.slice('$lib/'.length).split('/')));
  } else if (spec.startsWith('.')) {
    const fromAbsolute = path.join(projectRoot, ...fromFileRel.split('/'));
    absolute = path.normalize(path.resolve(path.dirname(fromAbsolute), spec));
  } else {
    return null;
  }
  const relative = path.relative(libRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}

/**
 * Реши, запрещён ли импорт внутреннего файла.
 *
 * @param {string} fromFileRel путь файла от корня проекта
 * @param {string} spec путь модуля
 * @param {string} [projectRoot] корень проекта
 * @returns {boolean} true, если импорт запрещён
 */
export function isBannedDeepImport(fromFileRel, spec, projectRoot = PROJECT_ROOT) {
  if (spec.startsWith('$lib/')) return isDeepInternalSpec(spec);
  if (!spec.startsWith('.')) return false;

  const underLib = resolveUnderLib(fromFileRel, spec, projectRoot);
  if (underLib === null) return false;

  const segments = underLib.split('/').filter(Boolean);
  const privateIndex = segments.findIndex((segment) => segment.startsWith('_'));
  if (privateIndex === -1) return false;

  const packageRootSegments = segments.slice(0, privateIndex);
  if (packageRootSegments.length === 0) return true;

  const packageRoot = path.join(path.join(projectRoot, 'src', 'lib'), ...packageRootSegments);
  const fromAbsolute = path.normalize(path.join(projectRoot, ...fromFileRel.split('/')));
  const relativeToPackage = path.relative(packageRoot, fromAbsolute);
  return relativeToPackage.startsWith('..') || path.isAbsolute(relativeToPackage);
}

/**
 * Собери запрещённые внутренние импорты файла.
 *
 * @param {string} source текст файла
 * @param {string} fromFileRel путь файла от корня проекта
 * @param {string} [projectRoot] корень проекта
 * @returns {string[]} запрещённые пути
 */
export function findDeepInternalImports(source, fromFileRel, projectRoot = PROJECT_ROOT) {
  /** @type {string[]} */
  const found = [];
  const seen = new Set();

  /**
   * @param {string} spec путь модуля
   */
  function pushIfBanned(spec) {
    if (seen.has(spec)) return;
    if (isBannedDeepImport(fromFileRel, spec, projectRoot)) {
      seen.add(spec);
      found.push(spec);
    }
  }

  for (const line of extractImportExportLines(source)) {
    const spec = extractSpecFromLine(line);
    if (spec) pushIfBanned(spec);
  }
  for (const spec of findDynamicImportSpecs(source)) pushIfBanned(spec);
  return found;
}

/**
 * Обойди каталог и собери страницы.
 *
 * @param {string} dir абсолютный каталог
 * @param {string[]} [acc] накопитель
 * @returns {string[]} абсолютные пути
 */
export function walkRouteFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkRouteFiles(full, acc);
    } else if (PAGE_NAMES.has(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Обойди src и собери файлы для запрета внутренних импортов.
 *
 * @param {string} dir абсолютный каталог
 * @param {string[]} [acc] накопитель
 * @returns {string[]} абсолютные пути
 */
export function walkDeepBanFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkDeepBanFiles(full, acc);
      continue;
    }
    if (isDeepBanExcludedFile(entry.name)) continue;
    if (entry.name.endsWith('.svelte') || entry.name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

/**
 * Переведи абсолютный путь в ключ с прямыми слешами.
 *
 * @param {string} absolutePath абсолютный путь
 * @param {string} [projectRoot] корень проекта
 * @returns {string} путь от корня проекта
 */
export function toProjectKey(absolutePath, projectRoot = PROJECT_ROOT) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

/**
 * Проверь один файл: число импортов и внутренние пути.
 *
 * @param {object} args аргументы
 * @param {string} args.relKey путь файла от корня
 * @param {string} args.source текст файла
 * @param {boolean} [args.checkBudget] считать лимит импортов
 * @param {number} [args.defaultMax] потолок строк import
 * @param {string} [args.projectRoot] корень проекта
 * @returns {{ ok: boolean, importCount: number, maxAllowed: number, deepInternals: string[], errors: string[] }} итог
 */
export function checkSource({
  relKey,
  source,
  checkBudget = true,
  defaultMax = DEFAULT_MAX_IMPORTS,
  projectRoot = PROJECT_ROOT,
}) {
  const importCount = countTopLevelImports(source);
  const deepInternals = findDeepInternalImports(source, relKey, projectRoot);
  /** @type {string[]} */
  const errors = [];

  if (checkBudget && importCount > defaultMax) {
    errors.push(`${relKey}: импортов ${importCount}, лимит ${defaultMax}`);
  }
  for (const spec of deepInternals) {
    errors.push(`${relKey}: внутренний импорт «${spec}». Берите публичный вход пакета.`);
  }

  return {
    ok: errors.length === 0,
    importCount,
    maxAllowed: defaultMax,
    deepInternals,
    errors,
  };
}

/**
 * Проверь дерево проекта.
 *
 * @param {object} [options] опции
 * @param {string} [options.projectRoot] корень проекта
 * @returns {{ ok: boolean, errors: string[] }} итог
 */
export function runCheck(options = {}) {
  const projectRoot = options.projectRoot ?? PROJECT_ROOT;
  const pageFiles = walkRouteFiles(path.join(projectRoot, 'src', 'routes'));
  const deepFiles = walkDeepBanFiles(path.join(projectRoot, 'src'));
  /** @type {string[]} */
  const errors = [];
  const seenPages = new Set();

  for (const absolute of pageFiles) {
    const relKey = toProjectKey(absolute, projectRoot);
    seenPages.add(relKey);
    const source = fs.readFileSync(absolute, 'utf8');
    errors.push(...checkSource({ relKey, source, checkBudget: true, projectRoot }).errors);
  }

  for (const absolute of deepFiles) {
    const relKey = toProjectKey(absolute, projectRoot);
    if (seenPages.has(relKey)) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    errors.push(...checkSource({ relKey, source, checkBudget: false, projectRoot }).errors);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Запусти проверку из командной строки.
 *
 * @returns {number} код выхода
 */
function main() {
  const { ok, errors } = runCheck();
  if (!ok) {
    for (const error of errors) console.error(error);
    return 1;
  }
  console.log('import-budget: ok');
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  process.exit(main());
}
