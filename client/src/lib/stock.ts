export const calculateTotalAmount = (mode: string, qty: number, pps: number, fees: number) => {
  if (qty <= 0 || pps <= 0) return 0;

  const grossAmount = qty * pps;
  return mode === 'buy' ? grossAmount + fees : grossAmount - fees;
};
