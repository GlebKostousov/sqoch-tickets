/**
 * Шаги одного оформления и ввод, который остаётся после ошибки проверки.
 * Экземпляр хранит данные в памяти. Источник мест передаётся снаружи.
 */

import {
  MAX_PARTICIPANTS,
  validateOrder,
  type OrderDraft,
  type ParticipantDraft,
  type ValidatedOrder,
  type ValidationIssues,
} from './_domain';
import { BookingError, type BookingGateway, type BookingReceipt } from './_gateway';

export type CheckoutStep = 'participants' | 'review' | 'success' | 'sold-out';

/**
 * Одно оформление: участники, шаг и результат подтверждения.
 *
 * Attributes:
 *   participants: Черновик участников.
 *   email: Контактный email заказа.
 *   step: Текущий шаг.
 *   issues: Ошибки полей после попытки проверки.
 *   order: Заказ, показанный на шаге проверки.
 *   receipt: Подтверждённый заказ.
 *   pending: Идёт запрос подтверждения.
 *   error: Текст сбоя, после которого ввод сохранён.
 */
export class CheckoutState {
  participants = $state<readonly ParticipantDraft[]>([{ id: 'participant-1', name: '', age: '' }]);
  email = $state('');
  step = $state<CheckoutStep>('participants');
  issues = $state<ValidationIssues>({ participants: {} });
  order = $state<ValidatedOrder | null>(null);
  receipt = $state<BookingReceipt | null>(null);
  pending = $state(false);
  error = $state('');
  private attempted = false;
  private sequence = 1;
  private requestKey: string | null = null;
  private fingerprint: string | null = null;

  /**
   * Начни оформление с переданным источником мест.
   *
   * @param gateway Кто подтверждает заказ и решает, остались ли места.
   */
  constructor(private readonly gateway: BookingGateway) {}

  /**
   * Собери текущий черновик для проверки.
   *
   * @returns Участники и email в том виде, как они введены.
   */
  get draft(): OrderDraft {
    return { participants: this.participants, email: this.email };
  }

  /**
   * Покажи проблему состава, если она уже видна по возрастам.
   *
   * @returns Текст про сопровождающего. undefined, если состав допустим или поля ещё пустые.
   */
  get accompanimentIssue(): string | undefined {
    const result = validateOrder(this.draft);
    return result.ok ? undefined : result.issues.order;
  }

  /**
   * Запиши имя или возраст участника.
   *
   * @param id Идентификатор строки участника.
   * @param field Какое поле меняется.
   * @param value Новое значение из поля ввода.
   */
  updateParticipant(id: string, field: 'name' | 'age', value: string): void {
    this.participants = this.participants.map((participant) =>
      participant.id === id ? { ...participant, [field]: value } : participant,
    );
    this.refreshIssues();
  }

  /**
   * Запиши контактный email заказа.
   *
   * @param value Новое значение поля.
   */
  updateEmail(value: string): void {
    this.email = value;
    this.refreshIssues();
  }

  /**
   * Добавь пустую строку участника.
   *
   * @returns Идентификатор новой строки. null, если в заказе уже максимум.
   */
  addParticipant(): string | null {
    if (this.participants.length >= MAX_PARTICIPANTS) return null;
    this.sequence += 1;
    const id = `participant-${this.sequence}`;
    this.participants = [...this.participants, { id, name: '', age: '' }];
    this.refreshIssues();
    return id;
  }

  /**
   * Убери участника, если в заказе останется хотя бы один.
   *
   * @param id Идентификатор строки участника.
   */
  removeParticipant(id: string): void {
    if (this.participants.length <= 1) return;
    this.participants = this.participants.filter((participant) => participant.id !== id);
    this.refreshIssues();
  }

  /**
   * Проверь черновик и перейди к экрану состава.
   *
   * @returns true, если заказ можно показывать на проверке.
   */
  review(): boolean {
    if (this.pending) return false;
    this.attempted = true;
    const result = validateOrder(this.draft);
    if (!result.ok) {
      this.issues = result.issues;
      return false;
    }
    this.issues = { participants: {} };
    this.order = result.order;
    const fingerprint = JSON.stringify(result.order);
    if (fingerprint !== this.fingerprint) this.requestKey = null;
    this.fingerprint = fingerprint;
    this.error = '';
    this.step = 'review';
    return true;
  }

  /**
   * Вернись к полям участников, не стирая ввод.
   */
  edit(): void {
    if (this.pending || this.step === 'success') return;
    this.step = 'participants';
    this.error = '';
  }

  /**
   * Подтверди проверенный заказ один раз.
   * Повторный вызов во время запроса ничего не делает.
   */
  async confirm(): Promise<void> {
    if (this.pending || this.step !== 'review' || !this.order) return;
    this.pending = true;
    this.error = '';
    try {
      // getRandomValues работает и при проверке телефона через http://локальный-IP.
      this.requestKey ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      this.receipt = await this.gateway.confirm(this.order, this.requestKey);
      this.step = 'success';
    } catch (error: unknown) {
      if (error instanceof BookingError && error.code === 'sold_out') {
        this.step = 'sold-out';
      } else {
        this.error =
          error instanceof BookingError
            ? error.publicMessage
            : 'Не удалось подтвердить заказ. Попробуйте ещё раз — данные сохранены.';
      }
    } finally {
      this.pending = false;
    }
  }

  /**
   * Обнови ошибки полей после правки, если проверку уже запускали.
   */
  private refreshIssues(): void {
    if (!this.attempted) return;
    const result = validateOrder(this.draft);
    this.issues = result.ok ? { participants: {} } : result.issues;
  }
}
