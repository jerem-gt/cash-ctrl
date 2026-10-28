import { currentLocale } from './format';

export interface LastUsedParts {
  kind: 'today' | 'yesterday' | 'date';
  time: string;
  date: string;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Décompose un horodatage en « aujourd'hui / hier / date » + heure locale, dans la langue courante. */
export function lastUsedParts(timestamp: number, now: Date = new Date()): LastUsedParts {
  const locale = currentLocale();
  const d = new Date(timestamp);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  let kind: LastUsedParts['kind'] = 'date';
  if (sameDay(d, now)) {
    kind = 'today';
  } else if (sameDay(d, yesterday)) {
    kind = 'yesterday';
  }
  return {
    kind,
    time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d),
    date: new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d),
  };
}
