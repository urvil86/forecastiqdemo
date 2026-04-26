export function netPriceFromGross(gross: number, gtnRate: number): number {
  return gross * (1 - gtnRate);
}
