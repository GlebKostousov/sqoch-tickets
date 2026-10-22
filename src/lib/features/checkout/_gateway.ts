/**
 * Подтверждение заказа: контракт источника мест и учебный источник с ограниченным залом.
 * Повтор с тем же ключом и тем же составом возвращает тот же результат.
 */

import { validateOrder, type Participant, type TicketLine, type ValidatedOrder } from './_domain';

export interface BookingReceipt extends ValidatedOrder {
  readonly id: string;
}

/**
 * Источник, который подтверждает уже проверенный заказ.
 */
export interface BookingGateway {
  /**
   * Подтверди заказ и запомни ключ запроса.
   *
   * @param order Состав и сумма после проверки правил.
   * @param requestKey Ключ повтора: тот же ключ и тот же состав дают тот же ответ.
   * @returns Подтверждённый заказ с номером.
   * @throws BookingError Мест нет, состав не сошёлся или ключ использован с другим составом.
   */
  confirm(order: ValidatedOrder, requestKey: string): Promise<BookingReceipt>;
}

export type BookingErrorCode = 'sold_out' | 'invalid_order' | 'request_conflict';

/**
 * Ошибка подтверждения с отдельным текстом для человека и для диагностики.
 *
 * Attributes:
 *   code: Машинный код исхода.
 *   publicMessage: Текст, который можно показать на экране.
 *   privateMessage: Подробность для журнала, на экран не выводится.
 */
export class BookingError extends Error {
  /**
   * Собери ошибку подтверждения.
   *
   * @param code Машинный код исхода.
   * @param publicMessage Текст для экрана.
   * @param privateMessage Подробность для журнала.
   */
  constructor(
    readonly code: BookingErrorCode,
    readonly publicMessage: string,
    readonly privateMessage: string,
  ) {
    super(privateMessage);
    this.name = 'BookingError';
  }
}

export interface MockBookingOptions {
  readonly scenario: 'success' | 'sold_out';
  readonly delayMs?: number;
  readonly capacity?: number;
}

interface RequestRecord {
  readonly fingerprint: string;
  readonly promise: Promise<BookingReceipt>;
}

function invalidOrder(): BookingError {
  return new BookingError(
    'invalid_order',
    'Не удалось проверить заказ. Вернитесь к данным участников.',
    'Booking payload failed validation or contains an inconsistent price.',
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLine(value: unknown): TicketLine {
  if (!isRecord(value) || !isRecord(value.participant)) throw invalidOrder();
  const participant = value.participant;
  if (
    typeof participant.id !== 'string' ||
    typeof participant.name !== 'string' ||
    typeof participant.age !== 'number' ||
    typeof value.price !== 'number' ||
    (value.kind !== 'full' && value.kind !== 'child')
  ) {
    throw invalidOrder();
  }
  return {
    participant: { id: participant.id, name: participant.name, age: participant.age },
    price: value.price,
    kind: value.kind,
  };
}

/**
 * Прими заказ как недоверенные данные и пересчитай его заново.
 *
 * @param value Состав, который пришёл на подтверждение.
 * @returns Замороженный заказ с ценой, посчитанной здесь.
 * @throws BookingError Состав, цена или тариф не сходятся с правилами.
 */
function normalizeOrder(value: unknown): ValidatedOrder {
  if (
    !isRecord(value) ||
    typeof value.email !== 'string' ||
    typeof value.total !== 'number' ||
    !Array.isArray(value.lines)
  ) {
    throw invalidOrder();
  }
  const rawLines: readonly unknown[] = value.lines;
  const submittedLines = Array.from(rawLines, parseLine);
  const result = validateOrder({
    email: value.email,
    participants: submittedLines.map(({ participant }) => ({
      ...participant,
      age: String(participant.age),
    })),
  });
  if (!result.ok || result.order.total !== value.total) throw invalidOrder();
  for (const [index, line] of result.order.lines.entries()) {
    const submitted = submittedLines[index];
    if (!submitted || submitted.kind !== line.kind || submitted.price !== line.price) {
      throw invalidOrder();
    }
  }
  return Object.freeze({
    ...result.order,
    lines: Object.freeze(
      result.order.lines.map((line) =>
        Object.freeze({
          ...line,
          participant: Object.freeze<Participant>({ ...line.participant }),
        }),
      ),
    ),
  });
}

/**
 * Собери учебный источник мест для одного экрана.
 *
 * @param options Сценарий успеха или пустого зала, пауза и вместимость.
 * @returns Подтверждение, которое помнит ключи запросов в памяти этого вызова.
 * @throws RangeError Пауза или вместимость заданы недопустимым числом.
 */
export function createMockBookingGateway(options: MockBookingOptions): BookingGateway {
  const scenario = options.scenario;
  const delayMs = options.delayMs ?? 650;
  let remaining = options.capacity ?? 24;
  if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isInteger(remaining) || remaining < 0) {
    throw new RangeError('Mock delay and capacity must be non-negative finite values.');
  }
  let sequence = 1000;
  const requests = new Map<string, RequestRecord>();

  function confirm(order: ValidatedOrder, requestKey: string): Promise<BookingReceipt> {
    let snapshot: ValidatedOrder;
    try {
      if (!requestKey.trim() || requestKey.length > 200) throw invalidOrder();
      snapshot = normalizeOrder(order);
    } catch (error) {
      return Promise.reject(error);
    }

    const fingerprint = JSON.stringify(snapshot);
    const previous = requests.get(requestKey);
    if (previous) {
      if (previous.fingerprint === fingerprint) return previous.promise;
      return Promise.reject(
        new BookingError(
          'request_conflict',
          'Данные заказа изменились. Проверьте их и подтвердите ещё раз.',
          'The same request key was reused with a different booking payload.',
        ),
      );
    }

    const promise = complete(snapshot);
    requests.set(requestKey, { fingerprint, promise });
    return promise;
  }

  async function complete(order: ValidatedOrder): Promise<BookingReceipt> {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    if (scenario === 'sold_out') remaining = 0;
    // Проверка и списание мест выполняются вместе, без await между ними.
    if (remaining < order.lines.length) {
      throw new BookingError(
        'sold_out',
        'Пока вы оформляли заказ, последние места разобрали.',
        'Mock inventory has insufficient seats at confirmation time.',
      );
    }
    remaining -= order.lines.length;
    sequence += 1;
    return Object.freeze({ ...order, id: `SQ-${sequence}` });
  }

  return { confirm };
}
