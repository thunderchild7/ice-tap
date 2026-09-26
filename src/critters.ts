import type { SpeciesId } from "./logic";

const stroke = "#10242c";

export const CRITTERS: Record<SpeciesId, string> = {
  perch: `<svg class="sprite" viewBox="0 0 100 70" aria-hidden="true">
    <path d="M76 35l18-12-4 12 4 12z" fill="#b7ddd4" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="46" cy="36" rx="28" ry="16" fill="#d7f3ec" stroke="${stroke}" stroke-width="2"/>
    <ellipse cx="46" cy="40" rx="24" ry="9" fill="#8ec9b8"/>
    <path d="M36 22c6-9 16-8 22 0" fill="#7eb8a8" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="28" cy="34" r="3" fill="${stroke}"/>
    <circle cx="27" cy="33" r="1" fill="#fff"/>
  </svg>`,
  trout: `<svg class="sprite" viewBox="0 0 110 70" aria-hidden="true">
    <path d="M84 36l20-11-5 11 5 12z" fill="#c4b48a" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="50" cy="36" rx="32" ry="15" fill="#8ea56a" stroke="${stroke}" stroke-width="2"/>
    <ellipse cx="50" cy="41" rx="28" ry="8" fill="#f3e6c4"/>
    <circle cx="40" cy="34" r="2.1" fill="#e07a8a"/>
    <circle cx="52" cy="31" r="1.7" fill="#e07a8a"/>
    <circle cx="62" cy="36" r="1.8" fill="#e07a8a"/>
    <circle cx="48" cy="40" r="1.4" fill="#e07a8a"/>
    <circle cx="30" cy="34" r="2.8" fill="${stroke}"/>
    <circle cx="29" cy="33" r="0.9" fill="#fff"/>
  </svg>`,
  char: `<svg class="sprite" viewBox="0 0 100 72" aria-hidden="true">
    <path d="M74 36l18-12-3 12 3 12z" fill="#ffb07a" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="46" cy="38" rx="28" ry="16" fill="#ff9447" stroke="${stroke}" stroke-width="2"/>
    <ellipse cx="46" cy="32" rx="26" ry="10" fill="#2f6b52"/>
    <path d="M34 20c7-8 16-7 22 1" fill="#245743" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="28" cy="36" r="3" fill="${stroke}"/>
    <circle cx="27" cy="35" r="1" fill="#fff"/>
    <path d="M40 44c6 4 14 4 20 0" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
  </svg>`,
  pike: `<svg class="sprite" viewBox="0 0 128 64" aria-hidden="true">
    <path d="M102 33l20-8-5 8 5 8z" fill="#6fd7c8" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="62" cy="34" rx="42" ry="11" fill="#1c8f88" stroke="${stroke}" stroke-width="2"/>
    <ellipse cx="64" cy="37" rx="34" ry="6" fill="#d9fff4"/>
    <path d="M24 34L8 27l5 7-5 8z" fill="#178078" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="30" cy="31" r="2.3" fill="${stroke}"/>
    <circle cx="29.3" cy="30.3" r="0.8" fill="#fff"/>
    <ellipse cx="50" cy="32" rx="3.2" ry="2" fill="#c9b6ff"/>
    <ellipse cx="68" cy="31" rx="3.4" ry="2" fill="#7dffc3"/>
    <ellipse cx="84" cy="34" rx="2.8" ry="1.8" fill="#ffd56a"/>
  </svg>`,
  boot: `<svg class="sprite" viewBox="0 0 80 84" aria-hidden="true">
    <path d="M24 10h20c2 0 4 2 4 4v26h12c3 0 6 3 6 6v10c0 4-3 7-7 7H28c-7 0-13-4-15-11l-3-10c-1-5 2-9 6-10l8-2V14c0-2 2-4 4-4z" fill="#6b4632" stroke="#1b120c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 10h20v9H24z" fill="#8d6248"/>
    <path d="M26 58h34" stroke="#e2c2a4" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  seal: `<svg class="sprite" viewBox="0 0 80 84" aria-hidden="true">
    <ellipse cx="40" cy="62" rx="24" ry="13" fill="#8aa0ae" stroke="${stroke}" stroke-width="2"/>
    <circle cx="40" cy="36" r="18" fill="#d5e2ea" stroke="${stroke}" stroke-width="2"/>
    <circle cx="33" cy="34" r="2.4" fill="${stroke}"/>
    <circle cx="47" cy="34" r="2.4" fill="${stroke}"/>
    <ellipse cx="40" cy="41" rx="3.2" ry="2.2" fill="#24343e"/>
    <path d="M16 38h8M56 38h8M14 44h8M58 44h8" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  crack: `<svg class="sprite" viewBox="0 0 80 80" aria-hidden="true">
    <path d="M40 8l8 18 18 4-14 12 4 18-16-10-16 10 4-18L14 30l18-4z" fill="#e7f7ff" stroke="#6e8fa3" stroke-width="2" stroke-linejoin="round"/>
    <path d="M40 24v26M40 38l12 8M40 38L30 48" stroke="#5f98b8" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
};
