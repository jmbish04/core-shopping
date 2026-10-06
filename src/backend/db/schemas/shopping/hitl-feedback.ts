import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const HITL_FEEDBACK_TABLE_DESCRIPTION =
  "Human-in-the-loop Tinder-style swipe feedback with structured rejection reason tags and calibrated embeddings.";

export const HITL_FEEDBACK_COLUMN_DESCRIPTIONS: Record<string, string> = {
  id: "Unique feedback entry ID.",
  proposalId: "Referenced proposal ID.",
  swipeAction: "Action taken: swipe_left (reject), swipe_right (approve), silent_track.",
  rejectionReasonTags: "Structured rejection tags (e.g. venue_veto, schedule_conflict, insufficient_detail).",
  userNotes: "Free-text comments or clarification from the user.",
  calibratedEmbedding: "Adjusted preference vector incorporating user feedback.",
  createdAt: "Timestamp of swipe decision.",
};

export const hitlFeedback = sqliteTable("hitl_feedback", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull(),
  swipeAction: text("swipe_action", {
    enum: ["swipe_left", "swipe_right", "silent_track"],
  }).notNull(),
  rejectionReasonTags: text("rejection_reason_tags", { mode: "json" }).$type<string[]>(),
  userNotes: text("user_notes"),
  calibratedEmbedding: text("calibrated_embedding", { mode: "json" }).$type<number[]>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertHitlFeedbackSchema = createInsertSchema(hitlFeedback);
export const selectHitlFeedbackSchema = createSelectSchema(hitlFeedback);
export type HitlFeedbackRow = typeof hitlFeedback.$inferSelect;
export type NewHitlFeedbackRow = typeof hitlFeedback.$inferInsert;
