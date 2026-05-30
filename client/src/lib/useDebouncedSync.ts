import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Synchronise une valeur locale (typiquement un input contrôlé) vers un
 * state externe après un délai d'inactivité, sans déclencher de re-render
 * intermédiaire. Idéal pour debouncer un filtre/recherche.
 *
 * - `localValue` : la valeur actuelle de l'input (string ou nombre)
 * - `derive` : transforme la valeur locale en la valeur "canonique" à
 *   pousser (ex. trim + lowercase, parse number…). Retourner `undefined`
 *   pour supprimer le filtre.
 * - `currentValue` : la valeur déjà appliquée — on ne déclenche `onChange`
 *   que si la valeur dérivée diffère.
 * - `onChange` : callback appelée avec la valeur dérivée après `delayMs`.
 * - `delayMs` : délai de debounce (défaut 300ms).
 */
export function useDebouncedSync<TLocal, TValue>(
  localValue: TLocal,
  derive: (local: TLocal) => TValue,
  currentValue: TValue,
  onChange: (value: TValue) => void,
  delayMs = 300,
): void {
  // Refs pour éviter de mettre derive/onChange en dépendance d'effect
  // (ils sont souvent inline donc nouvelle ref à chaque render).
  const onChangeRef = useRef(onChange);
  const deriveRef = useRef(derive);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    deriveRef.current = derive;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = deriveRef.current(localValue);
      if (next !== currentValue) onChangeRef.current(next);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [localValue, currentValue, delayMs]);
}
