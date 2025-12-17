/**
 * Color generation for chart trajectories using Golden Ratio.
 * Ensures maximum perceptual difference between colors for any count.
 */

/**
 * Golden ratio conjugate for color generation (maximizes perceptual difference)
 */
export const GOLDEN_RATIO_CONJUGATE = 0.618_033_988_749_895;

/**
 * User trajectory color - fixed dark gray
 */
export const USER_COLOR = "#1f2937";

/**
 * Matched context star color - fixed gold
 */
export const GOAL_STAR_COLOR = "#fbbf24";

/**
 * Generate distinct colors for N candidates using golden ratio.
 * Uses HSL color space with fixed saturation/lightness for perceptual uniformity.
 * Ensures maximum perceptual difference between all colors.
 *
 * @param count - Number of colors to generate
 * @returns Array of HSL color strings
 *
 * @example
 * const colors = generateCandidateColors(5);
 * // => ['hsl(180, 70%, 50%)', 'hsl(42, 70%, 50%)', ...]
 */
export function generateCandidateColors(count: number): string[] {
  const colors: string[] = [];
  let hue = 0.5; // Start from cyan (180°)

  for (let index = 0; index < count; index++) {
    hue = (hue + GOLDEN_RATIO_CONJUGATE) % 1;
    const hueDegrees = Math.floor(hue * 360);
    colors.push(`hsl(${hueDegrees}, 70%, 50%)`);
  }

  return colors;
}
