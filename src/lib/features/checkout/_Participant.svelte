<script lang="ts">
  // Строка одного участника: имя, возраст и цена его билета.
  import Icon from './_Icon.svelte';
  import {
    formatPrice,
    getTicketPrice,
    getTicketKind,
    MAX_AGE,
    parseAge,
    type ParticipantDraft,
    type ParticipantIssues,
  } from './_domain';
  let {
    participant,
    index,
    issues,
    canRemove,
    onChange,
    onRemove,
  }: {
    participant: ParticipantDraft;
    index: number;
    issues: ParticipantIssues | undefined;
    canRemove: boolean;
    onChange: (id: string, field: 'name' | 'age', value: string) => void;
    onRemove: (id: string) => void;
  } = $props();
  const age = $derived(parseAge(participant.age));
  const kind = $derived(age === null ? null : getTicketKind(age));
</script>

<fieldset class="participant-card">
  <legend
    ><span class="person-number">{String(index + 1).padStart(2, '0')}</span>Участник {index +
      1}</legend
  >
  {#if canRemove}<button
      class="icon-button remove-person"
      type="button"
      aria-label={`Удалить участника ${index + 1}`}
      onclick={() => onRemove(participant.id)}><Icon name="close" size={18} /></button
    >{/if}
  <div class="person-fields">
    <div class="field">
      <label for={`${participant.id}-name`}>Имя</label>
      <input
        id={`${participant.id}-name`}
        name={`${participant.id}-name`}
        type="text"
        value={participant.name}
        placeholder="Как вас зовут?"
        autocomplete="given-name"
        maxlength="120"
        aria-invalid={issues?.name ? 'true' : undefined}
        aria-describedby={issues?.name ? `${participant.id}-name-error` : undefined}
        oninput={(event) => onChange(participant.id, 'name', event.currentTarget.value)}
      />
      {#if issues?.name}<p id={`${participant.id}-name-error`} class="field-error">
          {issues.name}
        </p>{/if}
    </div>
    <div class="field age-field">
      <label for={`${participant.id}-age`}>Возраст<span class="label-unit">, лет</span></label>
      <input
        id={`${participant.id}-age`}
        name={`${participant.id}-age`}
        type="text"
        inputmode="numeric"
        value={participant.age}
        placeholder={`0–${MAX_AGE}`}
        autocomplete="off"
        maxlength="20"
        aria-invalid={issues?.age ? 'true' : undefined}
        aria-describedby={issues?.age ? `${participant.id}-age-error` : undefined}
        oninput={(event) => onChange(participant.id, 'age', event.currentTarget.value)}
      />
      {#if issues?.age}<p id={`${participant.id}-age-error`} class="field-error">
          {issues.age}
        </p>{/if}
    </div>
  </div>
  <div class="ticket-hint" aria-live="polite">
    {#if age !== null}<span class:child={kind === 'child'} class="ticket-label"
        ><Icon name="ticket" size={15} />{kind === 'child' ? 'Детский' : 'Полный'} билет</span
      ><span>{formatPrice(getTicketPrice(age))}</span>
    {:else}<span class="muted">Укажите возраст — рассчитаем стоимость</span>{/if}
  </div>
</fieldset>
