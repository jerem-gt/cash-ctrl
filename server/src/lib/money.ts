export const toCents = (euros: number): number => Math.round(euros * 100);
export const toEuros = (cents: number): number => cents / 100;
