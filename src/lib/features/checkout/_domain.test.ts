/**
 * Границы тарифа, сопровождения и полей заказа.
 */

import { describe, expect, it } from 'vitest';
import {
  estimateTotal,
  getTicketKind,
  getTicketPrice,
  parseAge,
  validateOrder,
  type OrderDraft,
  type ParticipantDraft,
} from './_domain';

/**
 * Собери одного участника для проверки правил.
 *
 * @param age Возраст строкой, как в поле формы.
 * @param id Идентификатор строки.
 * @param name Имя участника.
 * @returns Черновик участника.
 */
function participant(age: string, id = 'person-1', name = 'Анна'): ParticipantDraft {
  return { id, name, age };
}

/**
 * Собери заказ из возрастов с одним и тем же email.
 *
 * @param ages Возрасты участников по порядку.
 * @returns Черновик заказа.
 */
function draft(...ages: string[]): OrderDraft {
  return {
    email: 'anna@example.ru',
    participants: ages.map((age, index) => participant(age, `person-${index}`)),
  };
}

describe('тарифы и возраст', () => {
  it.each([
    [0, 'child', 1000],
    [13, 'child', 1000],
    [14, 'full', 2000],
    [17, 'full', 2000],
    [18, 'full', 2000],
  ] as const)('возраст %i определяет тариф %s', (age, kind, price) => {
    expect(getTicketKind(age)).toBe(kind);
    expect(getTicketPrice(age)).toBe(price);
  });

  it.each(['', ' ', '-1', '1.5', '1e2', '+18', '121', 'Infinity', 'NaN', '18 лет'])(
    'не принимает возраст «%s»',
    (age) => {
      expect(parseAge(age)).toBeNull();
    },
  );

  it('сохраняет различие между незаполненным возрастом и младенцем', () => {
    expect(parseAge('0')).toBe(0);
    expect(parseAge(' 18 ')).toBe(18);
    expect(parseAge('120')).toBe(120);
    expect(estimateTotal([participant('')])).toBeNull();
    expect(estimateTotal([participant('0')])).toBe(1000);
    expect(estimateTotal([])).toBeNull();
    expect(estimateTotal(draft('18', '13', '14').participants)).toBe(5000);
  });
});

describe('состав заказа', () => {
  it.each([
    [['13'], false],
    [['13', '17'], false],
    [['13', '18'], true],
    [['0', '18'], true],
    [['14'], true],
    [['17'], true],
    [['18', '0', '13', '14'], true],
  ] as const)('проверяет сопровождение для %j', (ages, accepted) => {
    expect(validateOrder(draft(...ages)).ok).toBe(accepted);
  });

  it('не позволяет оформить ноль или пять билетов', () => {
    expect(validateOrder(draft()).ok).toBe(false);
    expect(validateOrder(draft('18', '18', '18', '18', '18')).ok).toBe(false);
  });

  it('сохраняет имена на разных языках и убирает пробелы по краям', () => {
    const result = validateOrder({
      email: '  anna@example.ru ',
      participants: [participant('18', '1', '  Анна-Мария  '), participant('14', '2', '李')],
    });
    expect(result).toMatchObject({
      ok: true,
      order: {
        email: 'anna@example.ru',
        lines: [{ participant: { name: 'Анна-Мария' } }, { participant: { name: '李' } }],
        total: 4000,
      },
    });
  });

  it.each(['', ' ', 'a'.repeat(121)])('проверяет непригодное имя', (name) => {
    const result = validateOrder({ ...draft('18'), participants: [participant('18', '1', name)] });
    expect(result).toMatchObject({
      ok: false,
      issues: { participants: { '1': { name: expect.any(String) } } },
    });
  });

  it.each(['', 'anna', 'anna@', 'a@@example.ru', 'a b@example.ru', 'a@example'])(
    'проверяет email «%s»',
    (email) => {
      expect(validateOrder({ ...draft('18'), email })).toMatchObject({
        ok: false,
        issues: { email: expect.any(String) },
      });
    },
  );

  it('возвращает ошибки рядом с соответствующими полями', () => {
    expect(
      validateOrder({
        email: '',
        participants: [participant('', 'empty', '')],
      }),
    ).toMatchObject({
      ok: false,
      issues: {
        email: expect.any(String),
        participants: { empty: { name: expect.any(String), age: expect.any(String) } },
      },
    });
  });

  it('проверяет уникальность участников независимо от тарифа', () => {
    expect(
      validateOrder({
        email: 'anna@example.ru',
        participants: [participant('18'), participant('14')],
      }),
    ).toMatchObject({ ok: false, issues: { order: expect.any(String) } });
  });

  it('обрабатывает __proto__ как обычный id без изменения прототипа ошибок', () => {
    const result = validateOrder({
      email: 'anna@example.ru',
      participants: [participant('18', '__proto__', '')],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a name validation error.');
    expect(Object.hasOwn(result.issues.participants, '__proto__')).toBe(true);
    expect(result.issues.participants['__proto__']?.name).toBe('Укажите имя участника.');
    expect(Object.getPrototypeOf(result.issues.participants)).toBe(Object.prototype);
  });
});
