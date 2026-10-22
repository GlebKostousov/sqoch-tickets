<script lang="ts">
  // Карточка мероприятия «Ночь открытий» рядом с формой.
  import Icon from './_Icon.svelte';
  import {
    CHILD_TICKET_PRICE,
    FULL_TICKET_PRICE,
    CHILD_AGE_LIMIT,
    MAX_PARTICIPANTS,
    formatPrice,
  } from './_domain';
</script>

<aside class="event-panel" aria-label="О мероприятии">
  <div class="event-poster">
    <div class="poster-top"><span>ОРБИТА / СОБЫТИЯ</span><span class="poster-rating">0+</span></div>
    <h2>НОЧЬ<br />ОТКРЫТИЙ<span class="poster-dot">.</span></h2>
    <p>Большой вечер<br />маленьких открытий</p>
    <svg class="planet-art" viewBox="0 0 380 260" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="planet-light" cx="0.28" cy="0.2" r="0.9"
          ><stop stop-color="#ffc99a" /><stop offset="0.5" stop-color="#f37f4e" /><stop
            offset="1"
            stop-color="#a43321"
          /></radialGradient
        >
        <clipPath id="planet-clip"><circle cx="194" cy="134" r="76" /></clipPath>
      </defs>
      <circle cx="194" cy="134" r="76" fill="url(#planet-light)" />
      <g clip-path="url(#planet-clip)" stroke="#ffc292" stroke-width="0.8" opacity="0.4">
        <ellipse cx="184" cy="104" rx="93" ry="24" transform="rotate(-25 184 104)" /><ellipse
          cx="184"
          cy="129"
          rx="95"
          ry="24"
          transform="rotate(-25 184 129)"
        /><ellipse cx="184" cy="155" rx="91" ry="24" transform="rotate(-25 184 155)" /><ellipse
          cx="184"
          cy="180"
          rx="86"
          ry="24"
          transform="rotate(-25 184 180)"
        />
      </g>
      <ellipse
        cx="194"
        cy="134"
        rx="164"
        ry="44"
        transform="rotate(-28 194 134)"
        stroke="#ded9c1"
        stroke-width="1.2"
      />
      <ellipse
        cx="194"
        cy="134"
        rx="147"
        ry="34"
        transform="rotate(-28 194 134)"
        stroke="#ded9c1"
        stroke-width="0.5"
        opacity="0.5"
      />
      <path d="m49 72 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z" fill="#eddfb8" />
      <path d="m325 191 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#eddfb8" />
      <circle cx="301" cy="43" r="3" fill="#eddfb8" /><circle
        cx="81"
        cy="200"
        r="1.5"
        fill="#eddfb8"
      /><circle cx="273" cy="222" r="1.5" fill="#eddfb8" /><circle
        cx="112"
        cy="35"
        r="1"
        fill="#eddfb8"
      />
    </svg>
    <div class="poster-bottom"><span>СМОТРЕТЬ. УДИВЛЯТЬСЯ. ОТКРЫВАТЬ.</span><span>↗</span></div>
  </div>
  <div class="event-details">
    <div class="event-detail">
      <Icon name="calendar" />
      <div><strong>14 ноября 2026 · 18:00</strong><span>Суббота, время московское</span></div>
    </div>
    <div class="event-detail">
      <Icon name="pin" />
      <div><strong>Планетарий · Санкт-Петербург</strong><span>Обводный канал, 74Ц</span></div>
    </div>
  </div>
  <div class="prices">
    <div>
      <span>Полный <small>от {CHILD_AGE_LIMIT} лет</small></span><strong
        >{formatPrice(FULL_TICKET_PRICE)}</strong
      >
    </div>
    <div>
      <span>Детский <small>до {CHILD_AGE_LIMIT} лет</small></span><strong
        >{formatPrice(CHILD_TICKET_PRICE)}</strong
      >
    </div>
  </div>
  <p class="event-footnote">
    Звёзды ближе, когда вы вместе.<br />До {MAX_PARTICIPANTS} участников в одном заказе.
  </p>
</aside>
