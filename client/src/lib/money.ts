/** Euros → centimes entiers (évite les écarts flottants). */
export const toCents = (euros: number): number => Math.round(euros * 100);

/** Centimes → euros. */
export const toEuros = (cents: number): number => cents / 100;
