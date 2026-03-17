/**
 * Performance Ratio — Constants and plant defaults.
 *
 * Values from LIAR 2.0 Assumptions sheet for Angamos (PLT_A).
 * These serve as defaults; future plants may override via DB config.
 */

/** Minimum irradiance threshold (Wh/m2) — intervals below this are excluded from PR calc */
export const MIN_IRR_THRESHOLD = 75

/** LPr — Lower bound PR fraction for availability detection (LIAR 2.0: 0.5 = 50%) */
export const LPR_THRESHOLD = 0.5

/** LSp — Lower bound specific production fraction for availability (LIAR 2.0: 0.8 = 80%) */
export const LSP_THRESHOLD = 0.8

/** Guaranteed PR (contractual, fraction) */
export const GUARANTEED_PR = 0.8325

/** Guaranteed internal availability (contractual, fraction) */
export const GUARANTEED_AVAILABILITY = 0.99

/** Total peak power for PLT_A (kWp) — sum of all 40 inverters */
export const SUM_CI_KWP = 10517
