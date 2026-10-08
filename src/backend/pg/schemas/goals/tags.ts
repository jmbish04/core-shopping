/**
 * @fileoverview `tags` and `tag_mappings`: a real tag vocabulary attachable to
 * any row (goals, entities, proposals), never a comma-separated column.
 */

import { index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
});

export const tagMappings = pgTable(
  "tag_mappings",
  {
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    /** Table name of the tagged row, e.g. "goals". */
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.subjectType, t.subjectId] }), index("tag_mappings_subject_idx").on(t.subjectType, t.subjectId)],
);
