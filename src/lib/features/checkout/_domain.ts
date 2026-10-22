/**
 * Правила заказа билетов: возраст, тариф, состав и сумма.
 * Компоненты экрана вызывают эти функции и сами ничего не решают про допуск.
 */

export const MAX_PARTICIPANTS = 4;
export const MAX_AGE = 120;
export const CHILD_AGE_LIMIT = 14;
export const ACCOMPANYING_AGE = 18;
export const FULL_TICKET_PRICE = 2_000;
export const CHILD_TICKET_PRICE = 1_000;

export interface ParticipantDraft {
  readonly id: string;
  readonly name: string;
  readonly age: string;
}

export interface OrderDraft {
  readonly participants: readonly ParticipantDraft[];
  readonly email: string;
}

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly age: number;
}

export type TicketKind = 'full' | 'child';

export interface TicketLine {
  readonly participant: Participant;
  readonly kind: TicketKind;
  readonly price: number;
}

export interface ValidatedOrder {
  readonly email: string;
  readonly lines: readonly TicketLine[];
  readonly total: number;
}

export interface ParticipantIssues {
  readonly name?: string;
  readonly age?: string;
}

export interface ValidationIssues {
  readonly participants: Readonly<Record<string, ParticipantIssues>>;
  readonly email?: string;
  readonly order?: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly order: ValidatedOrder }
  | { readonly ok: false; readonly issues: ValidationIssues };

const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/**
 * Покажи сумму в рублях так, как её читают на экране.
 *
 * @param amount Сумма в целых рублях.
 * @returns Строка с разрядами и знаком рубля.
 */
export function formatPrice(amount: number): string {
  return rubles.format(amount);
}

/**
 * Разбери возраст из поля формы.
 *
 * @param value Строка из поля «Возраст», пробелы по краям допустимы.
 * @returns Целый возраст в допустимых границах. null, если это не возраст.
 */
export function parseAge(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const age = Number(trimmed);
  return Number.isInteger(age) && age >= 0 && age <= MAX_AGE ? age : null;
}

/**
 * Выбери тариф по уже разобранному возрасту.
 *
 * @param age Целый возраст участника.
 * @returns Детский тариф младше границы, иначе полный.
 */
export function getTicketKind(age: number): TicketKind {
  return age < CHILD_AGE_LIMIT ? 'child' : 'full';
}

/**
 * Верни цену билета в целых рублях.
 *
 * @param age Целый возраст участника.
 * @returns Цена детского или полного билета.
 */
export function getTicketPrice(age: number): number {
  return getTicketKind(age) === 'child' ? CHILD_TICKET_PRICE : FULL_TICKET_PRICE;
}

/**
 * Прикинь сумму заказа по черновику.
 * Пустой возраст не считается нулём лет и не получает детский тариф.
 *
 * @param participants Участники с возрастом в виде строки из поля.
 * @returns Сумма в рублях. null, если участников нет или возраст заполнен не у всех.
 */
export function estimateTotal(participants: readonly ParticipantDraft[]): number | null {
  if (participants.length === 0) return null;
  let total = 0;
  for (const participant of participants) {
    const age = parseAge(participant.age);
    if (age === null) return null;
    total += getTicketPrice(age);
  }
  return total;
}

/**
 * Проверь контактный email заказа.
 *
 * @param value Адрес без пробелов по краям.
 * @returns Текст ошибки. undefined, если адрес можно принять.
 */
function validateEmail(value: string): string | undefined {
  if (!value) return 'Укажите контактный email.';
  if (value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(value)) {
    return 'Проверьте email, например anna@example.ru.';
  }
  return undefined;
}

/**
 * Проверь черновик и собери заказ, который можно подтверждать.
 *
 * @param draft Участники и контактный email до подтверждения.
 * @returns Готовый заказ или ошибки рядом с полями и по составу.
 */
export function validateOrder(draft: OrderDraft): ValidationResult {
  const entries: [string, ParticipantIssues][] = [];
  const lines: TicketLine[] = [];
  let orderIssue: string | undefined;

  if (draft.participants.length < 1 || draft.participants.length > MAX_PARTICIPANTS) {
    orderIssue = 'В одном заказе может быть от 1 до 4 участников.';
  }
  const ids = draft.participants.map((participant) => participant.id);
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) {
    orderIssue = 'Не удалось определить участников. Создайте заказ заново.';
  }

  for (const participant of draft.participants) {
    const name = participant.name.trim();
    const age = parseAge(participant.age);
    const nameIssue = !name
      ? 'Укажите имя участника.'
      : name.length > 120
        ? 'Имя должно быть не длиннее 120 символов.'
        : undefined;
    const ageIssue = age === null ? 'Укажите целый возраст от 0 до 120 лет.' : undefined;
    if (nameIssue || ageIssue) {
      entries.push([
        participant.id,
        {
          ...(nameIssue ? { name: nameIssue } : {}),
          ...(ageIssue ? { age: ageIssue } : {}),
        },
      ]);
    }
    if (age !== null) {
      lines.push({
        participant: { id: participant.id, name, age },
        kind: getTicketKind(age),
        price: getTicketPrice(age),
      });
    }
  }

  const allAgesValid = lines.length === draft.participants.length;
  const hasChild = lines.some((line) => line.kind === 'child');
  const hasAccompanyingAdult = lines.some((line) => line.participant.age >= ACCOMPANYING_AGE);
  if (!orderIssue && allAgesValid && hasChild && !hasAccompanyingAdult) {
    orderIssue = 'Ребёнку младше 14 лет нужен участник от 18 лет в этом же заказе.';
  }

  const email = draft.email.trim();
  const emailIssue = validateEmail(email);
  if (entries.length || emailIssue || orderIssue) {
    return {
      ok: false,
      issues: {
        participants: Object.fromEntries(entries),
        ...(emailIssue ? { email: emailIssue } : {}),
        ...(orderIssue ? { order: orderIssue } : {}),
      },
    };
  }

  return {
    ok: true,
    order: { email, lines, total: lines.reduce((total, line) => total + line.price, 0) },
  };
}
