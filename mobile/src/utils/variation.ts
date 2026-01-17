export function computeVariationPrice(rule: 'mais_caro' | 'media' | 'fixo', basePrice: number, prices: number[], fixed?: number, fractions?: number[]): number {
  const arr = Array.isArray(prices) ? prices.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
  if (rule === 'mais_caro') {
    return arr.length > 0 ? Math.max(...arr) : Number(basePrice || 0);
  }
  if (rule === 'media') {
    const fracs = Array.isArray(fractions) ? fractions.map((f) => Number(f)).filter((f) => Number.isFinite(f) && f > 0) : [];
    if (fracs.length === arr.length && fracs.length > 0) {
      const wsum = arr.reduce((acc, n, i) => acc + n * fracs[i], 0);
      const fsum = fracs.reduce((acc, f) => acc + f, 0);
      return fsum > 0 ? (wsum / fsum) : Number(basePrice || 0);
    }
    const sum = arr.reduce((acc, n) => acc + n, 0);
    return arr.length > 0 ? (sum / arr.length) : Number(basePrice || 0);
  }
  if (rule === 'fixo') {
    const v = Number(fixed || 0);
    return v > 0 ? v : Number(basePrice || 0);
  }
  return Number(basePrice || 0);
}