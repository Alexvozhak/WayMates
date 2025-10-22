/**
 * Manual similarity implementations for A/B testing against GDS
 *
 * Used to validate GDS algorithm correctness and measure performance improvements.
 */

/**
 * Calculate Jaccard similarity between two sets
 *
 * Formula: |A ∩ B| / |A ∪ B|
 *
 * @param setA - First set
 * @param setB - Second set
 * @returns Jaccard similarity score [0.0, 1.0]
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1.0; // Both empty = identical
  }

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculate Overlap similarity between two sets
 *
 * Formula: |A ∩ B| / min(|A|, |B|)
 *
 * @param setA - First set
 * @param setB - Second set
 * @returns Overlap similarity score [0.0, 1.0]
 */
export function overlapSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1.0; // Both empty = identical
  }

  if (setA.size === 0 || setB.size === 0) {
    return 0.0; // One empty, one not = no overlap
  }

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const minSize = Math.min(setA.size, setB.size);

  return intersection.size / minSize;
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 *
 * Used to compare GDS results with manual implementation.
 * Value close to 1.0 indicates high correlation (algorithms agree).
 *
 * @param x - First array of scores
 * @param y - Second array of scores
 * @returns Pearson correlation coefficient [-1.0, 1.0]
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error('Arrays must have same length');
  }

  const n = x.length;
  if (n === 0) {
    return 0;
  }

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}
