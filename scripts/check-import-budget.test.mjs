import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkSource,
  countTopLevelImports,
  DEFAULT_MAX_IMPORTS,
  isBannedDeepImport,
  runCheck,
} from './check-import-budget.mjs';

test('считает только строки import', () => {
  const source = "import { a } from './a';\nconst importFake = 1;\nimport './b';\n";
  assert.equal(countTopLevelImports(source), 2);
});

test('страница не заходит во внутренний файл пакета', () => {
  assert.equal(
    isBannedDeepImport('src/routes/+page.svelte', '$lib/features/checkout/_domain'),
    true,
  );
  assert.equal(
    isBannedDeepImport('src/routes/+page.svelte', '../lib/features/checkout/_domain'),
    true,
  );
});

test('внутри пакета внутренний файл доступен', () => {
  assert.equal(
    isBannedDeepImport('src/lib/features/checkout/_Checkout.svelte', './_domain'),
    false,
  );
  assert.equal(
    isBannedDeepImport('src/lib/features/checkout/index.ts', './_Checkout.svelte'),
    false,
  );
});

test('новый экран с лишними импортами не проходит', () => {
  const lines = Array.from({ length: DEFAULT_MAX_IMPORTS + 1 }, (_, index) => {
    return `import { x${index} } from '$lib/features/checkout';`;
  });
  const result = checkSource({
    relKey: 'src/routes/+page.svelte',
    source: lines.join('\n'),
  });
  assert.equal(result.ok, false);
  assert.equal(result.importCount, DEFAULT_MAX_IMPORTS + 1);
});

test('текущее дерево проходит', () => {
  const result = runCheck();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});
