/**
 * Учебный источник мест: повтор ключа, пустой зал и подмена цены.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateOrder, type ValidatedOrder } from './_domain';
import { BookingError, createMockBookingGateway } from './_gateway';

/**
 * Собери уже проверенный заказ из возрастов.
 *
 * @param ages Возрасты участников.
 * @returns Заказ, который можно отправить на подтверждение.
 */
function order(...ages: string[]): ValidatedOrder {
  const result = validateOrder({
    email: 'anna@example.ru',
    participants: ages.map((age, index) => ({
      id: `p${index}`,
      name: `Участник ${index + 1}`,
      age,
    })),
  });
  if (!result.ok) throw new Error('Test order must be valid.');
  return result.order;
}

describe('mock gateway', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('проводит подтверждение асинхронно и возвращает состав заказа', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success' });
    const pending = gateway.confirm(order('18', '13'), 'first');
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({
      id: 'SQ-1001',
      email: 'anna@example.ru',
      total: 3000,
      lines: [{ price: 2000 }, { price: 1000 }],
    });
  });

  it('возвращает один результат для двойного клика и последующего повтора', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success', capacity: 1 });
    const first = gateway.confirm(order('18'), 'same');
    const duplicate = gateway.confirm(order('18'), 'same');
    expect(duplicate).toBe(first);
    await vi.runAllTimersAsync();
    const receipt = await first;
    expect(await gateway.confirm(order('18'), 'same')).toBe(receipt);
    const next = expect(gateway.confirm(order('18'), 'other')).rejects.toMatchObject({
      code: 'sold_out',
    });
    await vi.runAllTimersAsync();
    await next;
  });

  it('не принимает другие данные с уже использованным ключом', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success' });
    const first = gateway.confirm(order('18'), 'same');
    await expect(gateway.confirm(order('19'), 'same')).rejects.toMatchObject({
      code: 'request_conflict',
    });
    await vi.runAllTimersAsync();
    await first;
  });

  it('моделирует потерю мест только во время подтверждения', async () => {
    const gateway = createMockBookingGateway({ scenario: 'sold_out' });
    const failure = expect(gateway.confirm(order('18'), 'sold')).rejects.toMatchObject({
      code: 'sold_out',
      publicMessage: expect.any(String),
    });
    await vi.runAllTimersAsync();
    await failure;
  });

  it('не продаёт последнее место двум одновременным заказам', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success', capacity: 1 });
    const results = Promise.allSettled([
      gateway.confirm(order('18'), 'one'),
      gateway.confirm(order('19'), 'two'),
    ]);
    await vi.runAllTimersAsync();
    expect((await results).map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
  });

  it('списывает место на каждого участника заказа', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success', capacity: 1 });
    const failure = expect(gateway.confirm(order('18', '13'), 'family')).rejects.toMatchObject({
      code: 'sold_out',
    });
    await vi.runAllTimersAsync();
    await failure;
  });

  it('отклоняет подменённый итог и цену отдельного билета', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success' });
    const original = order('18');
    await expect(gateway.confirm({ ...original, total: 0 }, 'total')).rejects.toMatchObject({
      code: 'invalid_order',
    });
    await expect(
      gateway.confirm(
        {
          ...original,
          lines: original.lines.map((line) => ({ ...line, price: 1 })),
        },
        'price',
      ),
    ).rejects.toMatchObject({ code: 'invalid_order' });
  });

  it('заново проверяет правило сопровождения и тип билета на границе gateway', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success' });
    const original = order('18');
    const childAlone = {
      ...original,
      total: 1000,
      lines: original.lines.map((line) => ({
        ...line,
        participant: { ...line.participant, age: 13 },
        kind: 'child' as const,
        price: 1000,
      })),
    };
    await expect(gateway.confirm(childAlone, 'child')).rejects.toMatchObject({
      code: 'invalid_order',
    });
    await expect(
      gateway.confirm(
        {
          ...original,
          lines: original.lines.map((line) => ({ ...line, kind: 'child' as const })),
        },
        'kind',
      ),
    ).rejects.toMatchObject({ code: 'invalid_order' });
  });

  it('фиксирует снимок заказа до асинхронного ожидания', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success' });
    const participant = { id: 'p1', name: 'Анна', age: 18 };
    const mutable = {
      email: 'anna@example.ru',
      total: 2000,
      lines: [{ participant, kind: 'full' as const, price: 2000 }],
    };
    const pending = gateway.confirm(mutable, 'snapshot');
    mutable.email = 'changed@example.ru';
    participant.age = 13;
    await vi.runAllTimersAsync();
    const receipt = await pending;
    expect(receipt.email).toBe('anna@example.ru');
    expect(receipt.lines[0]?.participant.age).toBe(18);
    expect(Object.isFrozen(receipt.lines)).toBe(true);
  });

  it('возвращает типизированную ошибку без полей заказа в privateMessage', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success' });
    const invalid = { ...order('18'), email: 'not-an-email' };
    await expect(gateway.confirm(invalid, 'bad')).rejects.toBeInstanceOf(BookingError);
    await expect(gateway.confirm(invalid, 'bad')).rejects.toMatchObject({
      privateMessage: expect.not.stringContaining('not-an-email'),
    });
  });

  it('проверяет форму входных данных, даже если вызывающий обошёл TypeScript', async () => {
    const gateway = createMockBookingGateway({ scenario: 'success' });
    const malformed = {
      email: 'anna@example.ru',
      total: 2000,
      lines: [null],
    } as unknown as ValidatedOrder;
    await expect(gateway.confirm(malformed, 'bad-shape')).rejects.toMatchObject({
      code: 'invalid_order',
    });
  });
});
