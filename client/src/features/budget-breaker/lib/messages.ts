import type { TFunction } from 'i18next';

import type { BrickCategory } from './bricks';

function pick(value: unknown, random: () => number): string {
  if (!Array.isArray(value) || value.length === 0) return '';
  const index = Math.min(Math.floor(random() * value.length), value.length - 1);
  return String(value[index]);
}

export function pickHitMessage(
  t: TFunction<'game'>,
  category: BrickCategory,
  label: string,
  random: () => number = Math.random,
): string {
  const effective: BrickCategory = label === '' ? 'generic' : category;
  return pick(t(`hit.${effective}`, { returnObjects: true, label }), random);
}

export function pickLifeLostMessage(
  t: TFunction<'game'>,
  random: () => number = Math.random,
): string {
  return pick(t('life_lost', { returnObjects: true }), random);
}
