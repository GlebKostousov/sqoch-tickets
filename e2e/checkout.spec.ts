/**
 * Сценарии оформления в браузере на обычной ширине и на 360 пикселях.
 */

import { expect, test, type Page } from '@playwright/test';

/**
 * Заполни имя и возраст участника по номеру строки.
 *
 * @param page Открытая страница оформления.
 * @param index Номер участника, начиная с нуля.
 * @param name Имя.
 * @param age Возраст.
 */
async function fillParticipant(
  page: Page,
  index: number,
  name: string,
  age: string,
): Promise<void> {
  await page.getByLabel('Имя', { exact: true }).nth(index).fill(name);
  await page
    .getByLabel(/^Возраст/)
    .nth(index)
    .fill(age);
}

/**
 * Заполни заказ одного взрослого с email.
 *
 * @param page Открытая страница оформления.
 */
async function fillAdultOrder(page: Page): Promise<void> {
  await fillParticipant(page, 0, 'Анна Тестовая', '32');
  await page.getByLabel(/email/i).fill('anna@example.com');
}

/**
 * Перейди к шагу проверки заказа.
 *
 * @param page Открытая страница оформления.
 */
async function review(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Проверить заказ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Подтвердить заказ', exact: true })).toBeVisible();
}

/**
 * Проверь, что страница не шире окна.
 *
 * @param page Открытая страница оформления.
 */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport);
}

test('взрослый и ребёнок: данные, проверка, успешный заказ', async ({ page }) => {
  await page.goto('/');
  await fillAdultOrder(page);
  await page.getByRole('button', { name: 'Добавить участника', exact: true }).click();
  await fillParticipant(page, 1, 'Миша Тестовый', '13');
  await expectNoHorizontalOverflow(page);
  await review(page);
  await expect(page.getByText('Анна Тестовая', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Миша Тестовый', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('total')).toHaveText(/3\s?000\s?₽/);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Билеты ваши!' })).toBeVisible();
  await expect(page.getByText('anna@example.com', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: test.info().outputPath('success.png'), fullPage: true });
});

test('возраст 17 не сопровождает ребёнка; 18 сопровождает', async ({ page }) => {
  await page.goto('/');
  await fillParticipant(page, 0, 'Алексей', '17');
  await page.getByLabel(/email/i).fill('alex@example.com');
  await page.getByRole('button', { name: 'Добавить участника', exact: true }).click();
  await fillParticipant(page, 1, 'Саша', '13');
  await page.getByRole('button', { name: 'Проверить заказ', exact: true }).click();
  await expect(page.getByText(/Ребёнку младше 14 лет нужен участник от 18 лет/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Подтвердить заказ', exact: true })).toHaveCount(0);
  await page
    .getByLabel(/^Возраст/)
    .nth(0)
    .fill('18');
  await review(page);
  await expect(page.getByTestId('total')).toHaveText(/3\s?000\s?₽/);
});

test('с 14 лет можно оформить полный билет без сопровождающего', async ({ page }) => {
  await page.goto('/');
  await fillParticipant(page, 0, 'Полина', '14');
  await page.getByLabel(/email/i).fill('polina@example.com');
  await review(page);
  await expect(page.getByTestId('total')).toHaveText(/2\s?000\s?₽/);
});

test('редактирование перед подтверждением меняет состав и сумму', async ({ page }) => {
  await page.goto('/');
  await fillAdultOrder(page);
  await page.getByRole('button', { name: 'Добавить участника', exact: true }).click();
  await fillParticipant(page, 1, 'Миша', '13');
  await review(page);
  await page.getByRole('button', { name: 'Изменить данные', exact: true }).click();
  await expect(page.getByLabel('Имя', { exact: true }).first()).toHaveValue('Анна Тестовая');
  await expect(page.getByLabel(/email/i)).toHaveValue('anna@example.com');
  await page
    .getByLabel(/^Возраст/)
    .nth(1)
    .fill('14');
  await review(page);
  await expect(page.getByTestId('total')).toHaveText(/4\s?000\s?₽/);
});

test('до подтверждения заканчиваются места; введённое остаётся доступно', async ({ page }) => {
  await page.goto('/?scenario=sold-out');
  await fillAdultOrder(page);
  await review(page);
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Места закончились' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: test.info().outputPath('sold-out.png'), fullPage: true });
  await page.getByRole('button', { name: 'Вернуться к участникам', exact: true }).click();
  await expect(page.getByLabel('Имя', { exact: true }).first()).toHaveValue('Анна Тестовая');
  await expect(page.getByLabel(/^Возраст/).first()).toHaveValue('32');
  await expect(page.getByLabel(/email/i)).toHaveValue('anna@example.com');
});

test('пустая форма показывает ошибки и переводит фокус на первое поле', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Проверить заказ', exact: true }).click();
  await expect(page.getByLabel('Имя', { exact: true }).first()).toBeFocused();
  await expect(page.getByLabel('Имя', { exact: true }).first()).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel(/^Возраст/).first()).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(/email/i)).toHaveAttribute('aria-invalid', 'true');
  await expectNoHorizontalOverflow(page);
});

test('заказ ограничен четырьмя участниками', async ({ page }) => {
  await page.goto('/');
  const add = page.locator('#add-participant');
  await add.click();
  await add.click();
  await add.click();
  await expect(page.getByLabel('Имя', { exact: true })).toHaveCount(4);
  await expect(add).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test('на время запроса подтверждение блокируется', async ({ page }) => {
  await page.goto('/');
  await fillAdultOrder(page);
  await review(page);
  const confirm = page.getByRole('button', { name: 'Подтвердить заказ', exact: true });
  await confirm.click();
  await expect(
    page.getByRole('button', { name: /Оформляем|Подтверждаем|Проверяем/ }),
  ).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Билеты ваши!' })).toBeVisible();
});

test('переключение демо-сценария через ссылку сбрасывает форму и меняет результат', async ({
  page,
}) => {
  await page.goto('/');
  await fillAdultOrder(page);
  await page.getByText('Демо-сценарии', { exact: true }).click();
  await page.getByRole('link', { name: 'Места заканчиваются', exact: true }).click();
  await expect(page.getByLabel('Имя', { exact: true }).first()).toHaveValue('');
  await fillAdultOrder(page);
  await review(page);
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Места закончились' })).toBeVisible();
});

test('новый заказ после успеха начинается с пустой формы', async ({ page }) => {
  await page.goto('/');
  await fillAdultOrder(page);
  await review(page);
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Билеты ваши!' })).toBeVisible();
  await page.getByRole('link', { name: 'Оформить ещё один заказ', exact: true }).click();
  await expect(page.getByLabel('Имя', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('');
  await expect(page.getByLabel(/^Возраст/)).toHaveValue('');
  await expect(page.getByLabel(/email/i)).toHaveValue('');
});

test('подтверждение работает без crypto.randomUUID', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto('/');
  await fillAdultOrder(page);
  await review(page);
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Билеты ваши!' })).toBeVisible();
});

test('медленная загрузка JavaScript не теряет первый ввод', async ({ page }) => {
  let releaseScripts: () => void = () => undefined;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await scriptsReady;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect(page.getByLabel('Имя', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Проверить заказ', exact: true })).toBeDisabled();
  } finally {
    releaseScripts();
  }
  await fillAdultOrder(page);
  await review(page);
  await expect(page.getByText('Анна Тестовая', { exact: true })).toBeVisible();
});

test('удаление сопровождающего не позволяет подтвердить детский билет', async ({ page }) => {
  await page.goto('/');
  await fillAdultOrder(page);
  await page.getByRole('button', { name: 'Добавить участника', exact: true }).click();
  await fillParticipant(page, 1, 'Саша', '13');
  await review(page);
  await page.getByRole('button', { name: 'Изменить данные', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить участника 1', exact: true }).click();
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Саша');
  await page.getByRole('button', { name: 'Проверить заказ', exact: true }).click();
  await expect(page.getByText(/Ребёнку младше 14 лет нужен участник от 18 лет/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Подтвердить заказ', exact: true })).toHaveCount(0);
});

test('длинные имя и email не выходят за экран при проверке и в результате', async ({ page }) => {
  await page.goto('/');
  await fillParticipant(page, 0, 'А'.repeat(120), '32');
  await page.getByLabel(/email/i).fill(`${'a'.repeat(50)}@${'b'.repeat(60)}.example.com`);
  await review(page);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Билеты ваши!' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
