import { VOLUME_CHART_CONFIG, type Outcome } from "./data"

/** Diagonal hatching, shared by the chart's SVG tiles and the meter's CSS:
 *  stripe pitch and stripe width, in pixels. */
export const HATCH = 6
export const STRIPE = 2

/** Percent of the outcome mixed into the card for the hatch ground and its
 *  stripes; the signals run stronger than routine success. */
const HATCH_TONES: Record<Outcome, { ground: number; stripe: number }> = {
  success: { ground: 22, stripe: 52 },
  denied: { ground: 38, stripe: 86 },
  failed: { ground: 30, stripe: 74 },
}

/** oklab, since the card's explicit 0 hue bends an oklch mix red. */
const mix = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, var(--card))`

const paint = (outcome: Outcome) => ({
  ground: mix(VOLUME_CHART_CONFIG[outcome].color, HATCH_TONES[outcome].ground),
  stripe: mix(VOLUME_CHART_CONFIG[outcome].color, HATCH_TONES[outcome].stripe),
})

/** Each outcome's hatch colours, built once from the chart's own config. */
export const HATCH_PAINT: Record<Outcome, { ground: string; stripe: string }> =
  {
    success: paint("success"),
    denied: paint("denied"),
    failed: paint("failed"),
  }

/** The SVG hatch as a CSS background, its stripes leaning the same way. */
export function hatchBackground(outcome: Outcome) {
  const { ground, stripe } = HATCH_PAINT[outcome]
  return `repeating-linear-gradient(135deg, ${stripe} 0 ${STRIPE}px, ${ground} ${STRIPE}px ${HATCH}px)`
}