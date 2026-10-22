<script lang="ts">
  // Экран оформления: участники, проверка состава, успех или отказ из-за мест.
  import { onMount, tick, untrack } from 'svelte';
  import { resolve } from '$app/paths';
  import EventCard from './_EventCard.svelte';
  import Participant from './_Participant.svelte';
  import Icon from './_Icon.svelte';
  import {
    MAX_PARTICIPANTS,
    CHILD_AGE_LIMIT,
    ACCOMPANYING_AGE,
    estimateTotal,
    formatPrice,
  } from './_domain';
  import { createMockBookingGateway, type BookingGateway } from './_gateway';
  import { CheckoutState } from './_state.svelte';

  let { gateway }: { gateway?: BookingGateway } = $props();
  let scenario = $state<'success' | 'sold_out'>('success');
  let ready = $state(false);
  let model = $state(
    new CheckoutState(untrack(() => gateway) ?? createMockBookingGateway({ scenario: 'success' })),
  );
  let announcement = $state('');
  const total = $derived(estimateTotal(model.participants));
  const result = $derived(model.step === 'success' || model.step === 'sold-out');
  const stepNumber = $derived(model.step === 'participants' ? 1 : model.step === 'review' ? 2 : 3);

  onMount(() => {
    if (!gateway && new URLSearchParams(window.location.search).get('scenario') === 'sold-out') {
      scenario = 'sold_out';
      model = new CheckoutState(createMockBookingGateway({ scenario }));
    }
    ready = true;
  });

  async function focusHeading(): Promise<void> {
    await tick();
    document.querySelector<HTMLElement>('[data-step-heading]')?.focus();
  }

  async function review(): Promise<void> {
    const valid = model.review();
    await tick();
    if (valid) {
      await focusHeading();
    } else {
      const field = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      (field ?? document.getElementById('order-warning'))?.focus();
    }
  }

  async function addParticipant(): Promise<void> {
    const id = model.addParticipant();
    if (!id) return;
    announcement = `Добавлен участник ${model.participants.length}.`;
    await tick();
    document.getElementById(`${id}-name`)?.focus();
  }

  async function removeParticipant(id: string): Promise<void> {
    model.removeParticipant(id);
    announcement = `Участник удалён. В заказе: ${model.participants.length}.`;
    await tick();
    document.getElementById('add-participant')?.focus();
  }

  async function edit(): Promise<void> {
    model.edit();
    await focusHeading();
  }

  async function confirm(): Promise<void> {
    await model.confirm();
    await tick();
    if (model.error) document.getElementById('confirm-error')?.focus();
    else await focusHeading();
  }

  function saveReceipt(): void {
    const receipt = model.receipt;
    if (!receipt) return;
    const text = [
      'ОРБИТА · ДЕМОНСТРАЦИОННЫЙ ЗАКАЗ',
      'Это учебный пример, документ не является входным билетом.',
      `Заказ ${receipt.id}`,
      'Ночь открытий · 14 ноября 2026 · 18:00 МСК',
      ...receipt.lines.map(
        (line) =>
          `${line.participant.name}, ${line.participant.age} лет — ${line.kind === 'child' ? 'детский' : 'полный'} — ${formatPrice(line.price)}`,
      ),
      `Итого: ${formatPrice(receipt.total)}`,
      `Контактный email: ${receipt.email}`,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `orbita-${receipt.id}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<a href="#checkout" class="skip-link">Перейти к оформлению</a>
<header class="site-header">
  <a
    class="brand"
    href={resolve('/')}
    data-sveltekit-reload
    aria-label="Орбита — начать оформление заново"
  >
    <svg width="34" height="34" viewBox="0 0 48 48" fill="none" aria-hidden="true"
      ><circle cx="24" cy="24" r="9" fill="currentColor" /><ellipse
        cx="24"
        cy="24"
        rx="22"
        ry="9"
        transform="rotate(-35 24 24)"
        stroke="currentColor"
        stroke-width="2.5"
      /></svg
    >
    <span>орбита</span>
  </a>
  <span class="header-caption">ВПЕЧАТЛЕНИЯ БЛИЖЕ</span>
  <span class="demo-badge"><span></span>Демо · без оплаты</span>
</header>

<main class="page-layout">
  <EventCard />
  <section class="checkout-panel" id="checkout" aria-label="Оформление билетов">
    <nav class="stepper" aria-label="Шаги оформления">
      <ol>
        {#each ['Участники', 'Проверка', 'Готово'] as label, index (label)}
          <li
            class:active={stepNumber === index + 1}
            class:complete={stepNumber > index + 1}
            aria-current={stepNumber === index + 1 ? 'step' : undefined}
          >
            <span class="step-circle"
              >{#if stepNumber > index + 1}<Icon name="check" size={13} />{:else}{index +
                  1}{/if}</span
            ><span>{label}</span>
          </li>
        {/each}
      </ol>
    </nav>

    {#if model.step === 'participants'}
      <div class="step-heading">
        <span class="eyebrow">ПЛАНЫ НА ВЕЧЕР</span>
        <h1 tabindex="-1" data-step-heading>Кто идёт за открытиями?</h1>
        <p>Добавьте участников. Билет подберём по возрасту.</p>
      </div>
      <form
        novalidate
        aria-busy={!ready}
        onsubmit={(event) => {
          event.preventDefault();
          void review();
        }}
      >
        <fieldset class="form-scope" disabled={!ready}>
          <legend class="sr-only">Участники и контактный email</legend>
          <div class="form-topline">
            <h2>Участники</h2>
            <span>{model.participants.length} из {MAX_PARTICIPANTS}</span>
          </div>
          <div class="participants-list">
            {#each model.participants as participant, index (participant.id)}
              <Participant
                {participant}
                {index}
                issues={model.issues.participants[participant.id]}
                canRemove={model.participants.length > 1}
                onChange={(id, field, value) => model.updateParticipant(id, field, value)}
                onRemove={(id) => {
                  void removeParticipant(id);
                }}
              />
            {/each}
          </div>
          <button
            class="add-button"
            id="add-participant"
            type="button"
            disabled={model.participants.length >= MAX_PARTICIPANTS}
            onclick={() => {
              void addParticipant();
            }}
            ><Icon name="plus" size={18} />{model.participants.length >= MAX_PARTICIPANTS
              ? `Добавлено ${MAX_PARTICIPANTS} участника — это максимум`
              : 'Добавить участника'}</button
          >
          <div
            class:warning={Boolean(model.accompanimentIssue)}
            class="accompaniment-note"
            id="order-warning"
            tabindex="-1"
            role={model.accompanimentIssue ? 'alert' : undefined}
          >
            <Icon name="info" size={18} />
            <p>
              {model.accompanimentIssue ??
                `Детям до ${CHILD_AGE_LIMIT} лет нужен сопровождающий от ${ACCOMPANYING_AGE} лет в этом же заказе.`}
            </p>
          </div>
          <div class="contact-section">
            <h2>Связь с вами</h2>
            <div class="field">
              <label for="email">Контактный email</label><input
                id="email"
                name="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="you@example.ru"
                maxlength="254"
                value={model.email}
                oninput={(event) => model.updateEmail(event.currentTarget.value)}
                aria-invalid={model.issues.email ? 'true' : undefined}
                aria-describedby={model.issues.email ? 'email-error' : 'email-hint'}
              />
              {#if model.issues.email}<p id="email-error" class="field-error">
                  {model.issues.email}
                </p>{:else}<p id="email-hint" class="field-hint">
                  Один адрес для всех билетов в заказе.
                </p>{/if}
            </div>
          </div>
          <div class="checkout-action">
            <div class="total-line" aria-live="polite">
              <div>
                <span>Итого</span><small
                  >{total === null ? 'Рассчитаем по возрасту' : 'Все билеты, без доплат'}</small
                >
              </div>
              <strong data-testid="total">{total === null ? '— ₽' : formatPrice(total)}</strong>
            </div>
            <button class="button primary" type="submit"
              >Проверить заказ<Icon name="arrow" /></button
            >
            <p class="action-hint">На следующем шаге можно всё проверить и изменить.</p>
          </div>
        </fieldset>
      </form>
    {:else if model.step === 'review' && model.order}
      <div class="step-heading">
        <span class="eyebrow">ЕЩЁ ОДИН ШАГ</span>
        <h1 tabindex="-1" data-step-heading>Всё верно?</h1>
        <p>Проверьте участников и email перед подтверждением.</p>
      </div>
      <div class="review-card">
        <div class="form-topline">
          <h2>Ваши билеты</h2>
          <span>{model.order.lines.length} шт.</span>
        </div>
        <ul class="review-list">
          {#each model.order.lines as line, index (line.participant.id)}
            <li>
              <span class="review-person-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{line.participant.name}</strong><span
                  >{line.participant.age} лет · {line.kind === 'child' ? 'Детский' : 'Полный'} билет</span
                >
              </div>
              <b>{formatPrice(line.price)}</b>
            </li>
          {/each}
        </ul>
        <div class="review-email">
          <Icon name="mail" />
          <div><span>Контактный email</span><strong>{model.order.email}</strong></div>
        </div>
        <button
          class="text-button edit-button"
          type="button"
          disabled={model.pending}
          onclick={() => {
            void edit();
          }}><Icon name="back" size={17} />Изменить данные</button
        >
      </div>
      <div class="reservation-note">
        <Icon name="info" size={18} />
        <p>Места ещё не забронированы. Проверим их наличие при подтверждении заказа.</p>
      </div>
      <div class="checkout-action review-action" aria-busy={model.pending}>
        <div class="total-line">
          <div><span>Итого</span><small>Без комиссии и доплат</small></div>
          <strong data-testid="total">{formatPrice(model.order.total)}</strong>
        </div>
        {#if model.error}<p class="error-banner" role="alert" id="confirm-error" tabindex="-1">
            {model.error}
          </p>{/if}
        <button
          class="button primary"
          type="button"
          disabled={model.pending}
          onclick={() => {
            void confirm();
          }}
          >{#if model.pending}<span class="spinner" aria-hidden="true"></span>Проверяем наличие
            мест…{:else}Подтвердить заказ<Icon name="arrow" />{/if}</button
        >
        <p class="action-hint" role="status">
          {model.pending ? 'Это займёт пару секунд' : 'Демо-оформление: деньги не списываются.'}
        </p>
      </div>
    {:else if model.step === 'success' && model.receipt}
      <div class="result-header">
        <div class="result-symbol success-symbol"><Icon name="check" size={32} /></div>
        <span class="eyebrow">ДО ВСТРЕЧИ ПОД ЗВЁЗДАМИ</span>
        <h1 tabindex="-1" data-step-heading>Билеты ваши!</h1>
        <p>
          Заказ оформлен. Осталось дождаться<br class="desktop-only" /> вечера, полного открытий.
        </p>
      </div>
      <div class="receipt-card">
        <div class="receipt-top">
          <span>ОРБИТА / ВАШ ЗАКАЗ</span><strong>{model.receipt.id}</strong>
        </div>
        <h2>Ночь открытий</h2>
        <p>14 ноября · 18:00 · Санкт-Петербург</p>
        <div class="receipt-perforation"></div>
        <ul class="receipt-people">
          {#each model.receipt.lines as line (line.participant.id)}<li>
              <span
                >{line.participant.name}<small
                  >{line.participant.age} лет · {line.kind === 'child'
                    ? 'Детский'
                    : 'Полный'}</small
                ></span
              ><strong>{formatPrice(line.price)}</strong>
            </li>{/each}
        </ul>
        <div class="receipt-total">
          <span>Итого</span><strong>{formatPrice(model.receipt.total)}</strong>
        </div>
        <div class="receipt-email">Контактный email<strong>{model.receipt.email}</strong></div>
      </div>
      <div class="success-note">
        <Icon name="info" size={18} />
        <p>Это демонстрационный заказ. Настоящие билеты и письма не отправляются.</p>
      </div>
      <button class="button primary" type="button" onclick={saveReceipt}
        >Сохранить заказ<Icon name="download" /></button
      >
      <a class="button secondary" href={resolve('/')} data-sveltekit-reload
        >Оформить ещё один заказ</a
      >
    {:else if model.step === 'sold-out'}
      <div class="result-header">
        <div class="result-symbol sold-out-symbol"><Icon name="ticket" size={32} /></div>
        <span class="eyebrow">ИНОГДА ПЛАНЫ МЕНЯЮТСЯ</span>
        <h1 tabindex="-1" data-step-heading>Места закончились</h1>
        <p>Пока вы заполняли данные,<br class="desktop-only" /> последние билеты разобрали.</p>
      </div>
      <div class="sold-out-card">
        <div class="sold-out-title">
          <span class="status-dot"></span><strong>Заказ не оформлен</strong>
        </div>
        <p>Данные участников и email остались в форме. Вы можете вернуться к ним.</p>
        <div class="sold-out-details">
          <span>Ночь открытий</span><strong>14 ноября · 18:00</strong>
        </div>
      </div>
      <button
        class="button primary"
        type="button"
        onclick={() => {
          void edit();
        }}>Вернуться к участникам<Icon name="back" /></button
      >
      <p class="action-hint">В этом демо-сценарии мест больше нет.</p>
    {/if}
    <div class="checkout-footer" class:result-footer={result}>
      <Icon name="ticket" size={16} /><span>Один заказ. Общие впечатления.</span>
    </div>
  </section>
</main>

<footer class="site-footer">
  <span>© Орбита, 2026</span><span>Учебный проект для Sqoch</span>
  <details class="demo-controls">
    <summary>Демо-сценарии</summary>
    <div>
      <p>Начать оформление заново:</p>
      <a
        href={resolve('/')}
        data-sveltekit-reload
        aria-current={scenario === 'success' ? 'true' : undefined}>Успешный заказ</a
      ><a
        href={resolve('/?scenario=sold-out')}
        data-sveltekit-reload
        aria-current={scenario === 'sold_out' ? 'true' : undefined}>Места заканчиваются</a
      ><small
        >Выбран: {scenario === 'success' ? 'успешный заказ' : 'места заканчиваются'}. Все данные
        моковые.</small
      >
    </div>
  </details>
</footer>
<p class="sr-only" aria-live="polite">{announcement}</p>
