/**
 * Переходы оформления: проверка, правка, повтор подтверждения и отказ.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ValidatedOrder } from './_domain';
import { BookingError, type BookingGateway, type BookingReceipt } from './_gateway';
import { CheckoutState } from './_state.svelte';

/**
 * Собери ответ подтверждения для учебного источника.
 *
 * @param order Уже проверенный заказ.
 * @returns Тот же состав с фиксированным номером.
 */
function receipt(order: ValidatedOrder): BookingReceipt {
  return { ...order, id: 'SQ-TEST' };
}

/**
 * Доведи оформление до шага проверки.
 *
 * @param gateway Источник мест для этого экземпляра.
 * @returns Состояние на шаге проверки.
 */
function readyState(gateway: BookingGateway): CheckoutState {
  const state = new CheckoutState(gateway);
  state.updateParticipant('participant-1', 'name', 'Анна');
  state.updateParticipant('participant-1', 'age', '18');
  state.updateEmail('anna@example.ru');
  if (!state.review()) throw new Error('Test order must reach review.');
  return state;
}

/**
 * Собери подтверждение, которое сразу принимает заказ.
 *
 * @returns Подмена источника мест.
 */
function successfulGateway(): ReturnType<typeof vi.fn<BookingGateway['confirm']>> {
  return vi.fn<BookingGateway['confirm']>(async (order) => receipt(order));
}

describe('состояние оформления', () => {
  it('не запускает повторное подтверждение и не меняет шаг во время запроса', async () => {
    const deferred = Promise.withResolvers<BookingReceipt>();
    const confirm = vi.fn<BookingGateway['confirm']>().mockReturnValue(deferred.promise);
    const state = readyState({ confirm });
    const pending = state.confirm();

    expect(state.pending).toBe(true);
    await state.confirm();
    state.edit();
    expect(state.review()).toBe(false);
    expect(state.step).toBe('review');
    expect(confirm).toHaveBeenCalledTimes(1);

    const order = state.order;
    if (!order) throw new Error('Expected the reviewed order.');
    deferred.resolve(receipt(order));
    await pending;
    expect(state.pending).toBe(false);
    expect(state.step).toBe('success');
  });

  it('сбрасывает pending после неизвестной ошибки и повторяет тот же ключ', async () => {
    const confirm = successfulGateway().mockRejectedValueOnce(
      new Error('Internal connection error'),
    );
    const state = readyState({ confirm });

    await state.confirm();
    expect(state.pending).toBe(false);
    expect(state.step).toBe('review');
    expect(state.error).toBe(
      'Не удалось подтвердить заказ. Попробуйте ещё раз — данные сохранены.',
    );
    expect(state.error).not.toContain('Internal connection error');

    await state.confirm();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[0]?.[1]).toMatch(/^[a-f0-9]{32}$/);
    expect(confirm.mock.calls[1]?.[1]).toBe(confirm.mock.calls[0]?.[1]);
    expect(state.step).toBe('success');
    expect(state.error).toBe('');
  });

  it('сохраняет ключ после ошибки и возврата к неизменённым данным', async () => {
    const confirm = successfulGateway().mockRejectedValueOnce(new Error('Response was lost'));
    const state = readyState({ confirm });
    await state.confirm();

    state.edit();
    state.updateParticipant('participant-1', 'name', '  Анна  ');
    state.updateEmail('  anna@example.ru ');
    expect(state.review()).toBe(true);
    await state.confirm();

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1]?.[0]).toEqual(confirm.mock.calls[0]?.[0]);
    expect(confirm.mock.calls[1]?.[1]).toBe(confirm.mock.calls[0]?.[1]);
    expect(state.step).toBe('success');
  });

  it('создаёт новый ключ, когда после ошибки изменился подтверждаемый заказ', async () => {
    const confirm = successfulGateway().mockRejectedValueOnce(new Error('Response was lost'));
    const state = readyState({ confirm });
    await state.confirm();

    state.edit();
    state.updateEmail('new@example.ru');
    expect(state.review()).toBe(true);
    await state.confirm();

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1]?.[1]).not.toBe(confirm.mock.calls[0]?.[1]);
    expect(state.receipt?.email).toBe('new@example.ru');
  });

  it('сохраняет всех участников и email при потере мест', async () => {
    const confirm = vi
      .fn<BookingGateway['confirm']>()
      .mockRejectedValue(
        new BookingError('sold_out', 'Места закончились.', 'Mock capacity exhausted.'),
      );
    const state = readyState({ confirm });
    state.edit();
    const childId = state.addParticipant();
    if (!childId) throw new Error('Expected a second participant.');
    state.updateParticipant(childId, 'name', 'Миша');
    state.updateParticipant(childId, 'age', '13');
    expect(state.review()).toBe(true);
    const draft = {
      email: state.email,
      participants: state.participants.map((participant) => ({ ...participant })),
    };

    await state.confirm();
    expect(state.step).toBe('sold-out');
    expect(state.pending).toBe(false);
    expect(state.receipt).toBeNull();
    expect(state.draft).toEqual(draft);
    state.edit();
    expect(state.step).toBe('participants');
    expect(state.draft).toEqual(draft);
  });

  it('показывает подтверждённый заказ и не подтверждает его повторно после успеха', async () => {
    const confirm = successfulGateway();
    const state = readyState({ confirm });
    await state.confirm();

    expect(state.receipt).toMatchObject({ id: 'SQ-TEST', email: 'anna@example.ru', total: 2000 });
    expect(state.pending).toBe(false);
    expect(state.error).toBe('');
    expect(state.step).toBe('success');

    state.edit();
    await state.confirm();
    expect(state.step).toBe('success');
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});
