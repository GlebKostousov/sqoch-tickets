import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:5173';
const output = path.resolve(process.env.DEMO_OUTPUT_DIR ?? 'delivery/videos');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const recordings = [];

const pause = (page, milliseconds = 1200) => page.waitForTimeout(milliseconds);

async function participant(page, index, name, age) {
  await page.getByLabel('Имя', { exact: true }).nth(index).pressSequentially(name, { delay: 35 });
  await page
    .getByLabel(/^Возраст/)
    .nth(index)
    .fill(age);
}

async function click(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await pause(page);
}

async function record(name, viewport, run) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    recordVideo: { dir: path.join(output, 'raw'), size: viewport },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const video = page.video();
  const started = new Date().toISOString();
  try {
    await run(page);
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await context.close();
    await video.saveAs(path.join(output, `${name}.webm`));
    recordings.push({ name, viewport, started, finished: new Date().toISOString(), errors });
  }
}

try {
  await record('desktop', { width: 1280, height: 900 }, async (page) => {
    await page.goto(baseURL);
    await pause(page, 2200);
    await participant(page, 0, 'Анна Тестовая', '17');
    await page.getByLabel(/email/i).pressSequentially('anna@example.com', { delay: 35 });
    await click(page, 'Добавить участника');
    await participant(page, 1, 'Миша Тестовый', '13');
    await click(page, 'Проверить заказ');
    await pause(page, 1600);
    await page
      .getByLabel(/^Возраст/)
      .first()
      .fill('18');
    await click(page, 'Проверить заказ');
    await pause(page, 1700);
    await click(page, 'Изменить данные');
    await page
      .getByLabel(/^Возраст/)
      .nth(1)
      .fill('14');
    await click(page, 'Проверить заказ');
    await click(page, 'Подтвердить заказ');
    await page.getByRole('heading', { name: 'Билеты ваши!' }).waitFor();
    await pause(page, 2600);
    await page
      .getByRole('button', { name: 'Сохранить заказ', exact: true })
      .scrollIntoViewIfNeeded();
    await pause(page, 1200);

    await page.goto(`${baseURL}/?scenario=sold-out`);
    await pause(page);
    await participant(page, 0, 'Анна Тестовая', '32');
    await page.getByLabel(/email/i).fill('anna@example.com');
    await click(page, 'Проверить заказ');
    await click(page, 'Подтвердить заказ');
    await page.getByRole('heading', { name: 'Места закончились' }).waitFor();
    await pause(page, 2200);
    await click(page, 'Вернуться к участникам');
    await pause(page, 1700);
  });

  await record('mobile-360', { width: 360, height: 800 }, async (page) => {
    await page.goto(baseURL);
    await pause(page, 2200);
    await participant(page, 0, 'Анна Тестовая', '32');
    await click(page, 'Добавить участника');
    await participant(page, 1, 'Миша', '8');
    await page.getByLabel(/email/i).fill('anna@example.com');
    await pause(page);
    await click(page, 'Проверить заказ');
    await pause(page, 1800);
    await click(page, 'Подтвердить заказ');
    await page.getByRole('heading', { name: 'Билеты ваши!' }).waitFor();
    await pause(page, 2600);
    await page
      .getByRole('button', { name: 'Сохранить заказ', exact: true })
      .scrollIntoViewIfNeeded();
    await pause(page, 1600);
  });
} finally {
  await browser.close();
  await writeFile(path.join(output, 'metadata.json'), JSON.stringify(recordings, null, 2) + '\n');
}

console.log(`Видеозаписи реальных сценариев: ${output}`);
