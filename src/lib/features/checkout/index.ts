/**
 * Публичный вход сценария оформления.
 * Страница берёт экран отсюда. Правила заказа и источник мест остаются внутри пакета.
 */

export { default as Checkout } from './_Checkout.svelte';
export type { BookingGateway, BookingReceipt } from './_gateway';
