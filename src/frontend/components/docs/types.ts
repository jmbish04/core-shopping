/**
 * @fileoverview Row shape shared by `DocRows.astro` and the docs pages that
 * build rows. Types live here because an `.astro` frontmatter cannot export one.
 */

export type DocRowStatus = "built" | "partial" | "planned" | "blocked";

export interface DocRow {
  term: string;
  body: string;
  /** Render the term in the monospace face (routes, tables, enum values). */
  mono?: boolean;
  /** Draws a ReUI Badge so what is built reads at a glance. */
  status?: DocRowStatus;
  /** A neutral outline badge: a goal category, an enum value. */
  tag?: string;
  /** Makes the term a link. */
  href?: string;
}
