/** Self-check for src/backend/pg/ledger.ts: an unmigrated or behind database must fail health. */
import assert from "node:assert/strict";

import { ledgerVerdict, newestJournalWhen } from "../src/backend/pg/ledger.ts";

assert.equal(newestJournalWhen({ entries: [{ when: 5 }, { when: 9 }, { when: 7 }] }), 9);
assert.equal(ledgerVerdict(9, null).status, "fail");
assert.equal(ledgerVerdict(9, 7).status, "fail");
assert.equal(ledgerVerdict(9, 9).status, "ok");
assert.equal(ledgerVerdict(9, 12).status, "ok");
console.log("selfcheck-pg-ledger: ok");
