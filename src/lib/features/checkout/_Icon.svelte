<script lang="ts">
  // Небольшая иконка экрана оформления.
  let {
    name,
    size = 20,
  }: {
    name:
      | 'arrow'
      | 'back'
      | 'plus'
      | 'close'
      | 'check'
      | 'calendar'
      | 'pin'
      | 'mail'
      | 'info'
      | 'ticket'
      | 'download';
    size?: number;
  } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'arrow'}<path d="M4 12h16m-6-6 6 6-6 6" />
  {:else if name === 'back'}<path d="M20 12H4m6-6-6 6 6 6" />
  {:else if name === 'plus'}<path d="M12 5v14M5 12h14" />
  {:else if name === 'close'}<path d="m6 6 12 12M6 18 18 6" />
  {:else if name === 'check'}<path d="m5 12 4 4L19 6" />
  {:else if name === 'calendar'}<rect x="3" y="5" width="18" height="16" rx="3" /><path
      d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"
    />
  {:else if name === 'pin'}<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle
      cx="12"
      cy="10"
      r="2.5"
    />
  {:else if name === 'mail'}<rect x="3" y="5" width="18" height="14" rx="3" /><path
      d="m4 7 8 6 8-6"
    />
  {:else if name === 'info'}<circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9v.1" />
  {:else if name === 'ticket'}<path
      d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"
    /><path d="M15 6v2m0 3v2m0 3v2" />
  {:else if name === 'download'}<path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3" />{/if}
</svg>
