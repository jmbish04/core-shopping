/**
 * @fileoverview Barrel for the core-shopping shared contracts. Backend routes
 * and the frontend client import from here (`@/shared/contracts`), never from
 * the files inside, so a moved schema is a one-line change.
 */

export * from "./common";
export * from "./goals";
export * from "./runs";
export * from "./catalog";
