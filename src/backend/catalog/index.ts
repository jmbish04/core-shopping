/**
 * @fileoverview Catalog: canonicalization, fingerprints and `recordSighting`
 * (maestro cs-be-4-1, cs-be-3-4). Import from here, never from the files inside.
 */

export * from "./canonical";
export * from "./findings";
export { recordSighting, SightingError } from "./record";
