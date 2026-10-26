/**
 * Self-check for GET /api/integrations (maestro cs-be-2-8, cs-c-08).
 *
 * This endpoint exists to report trouble, so the thing most likely to be
 * broken is the endpoint itself — the instrument that cannot fail. Every
 * branch below is driven with a fake probe answer, and each assertion is a
 * failure mode this project has already paid for somewhere:
 *
 * - **A down component must change the verdict.** `/health` on core-sg-data
 *   reported `browseros: unreachable` inside its own checks block and still
 *   answered `status: ok`, and BrowserOS stayed dead for 14 hours. So a `fail`
 *   must make the whole endpoint `fail` and a `warn` must make it `degraded`.
 * - **A written-down gap must NOT change the verdict.** Four integrations are
 *   declared and not built. Turning the page amber forever for them trains a
 *   reader to ignore amber, which is the same defect from the other side.
 * - **Absence is read from the DECLARATION, not inferred.** A required
 *   binding that is gone is a failure; a planned one that is gone is a stated
 *   gap. The same absence, opposite meanings.
 * - **A timeout is a failure.** A black-holed tunnel neither answers nor
 *   refuses. core-sg-data's deploy guard had a fallback that could not run on
 *   the one day port 22 stopped answering, because a hang is not an error.
 * - **At the daily cap the browser is unavailable to THIS Worker** even while
 *   core-browser is healthy, so `ok` there would be true about core-browser
 *   and false about what this Worker can do.
 * - **An unknown job count is null, never 0.** When the database is
 *   unreachable the count was not measured, and reporting 0 of 20 used would
 *   say there is a full day of capacity left.
 */
import assert from "node:assert/strict";

const {
  INTEGRATION_DECLARATIONS,
  INTEGRATION_REQUIREMENTS,
  INTEGRATION_STATUSES,
  absenceStatus,
  classifyCoreBrowser,
  overallStatus,
} = await import("../src/backend/api/routes/config/integration-rules.ts");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("selfcheck-integrations");

check("a failing component makes the whole endpoint fail", () => {
  assert.equal(overallStatus(["ok", "ok", "fail"]), "fail");
  assert.equal(overallStatus(["warn", "fail"]), "fail");
  // the order must not matter
  assert.equal(overallStatus(["fail", "ok"]), "fail");
});

check("a warning component degrades it", () => {
  assert.equal(overallStatus(["ok", "warn"]), "degraded");
  assert.equal(overallStatus(["warn"]), "degraded");
});

check("a written-down gap does not degrade it", () => {
  assert.equal(overallStatus(["ok", "not_built", "not_built"]), "ok");
  // and it never upgrades a real problem either
  assert.equal(overallStatus(["fail", "not_built"]), "fail");
  assert.equal(overallStatus(["warn", "not_built"]), "degraded");
});

check("all ok is ok, and an empty list cannot report trouble it did not find", () => {
  assert.equal(overallStatus(["ok", "ok"]), "ok");
  assert.equal(overallStatus([]), "ok");
});

check("the same absence is read differently by requirement", () => {
  assert.equal(absenceStatus("required"), "fail");
  assert.equal(absenceStatus("optional"), "warn");
  assert.equal(absenceStatus("planned"), "not_built");
  // every declared requirement has a reading, so a new one cannot fall through
  for (const requirement of INTEGRATION_REQUIREMENTS) {
    assert.ok(
      INTEGRATION_STATUSES.includes(absenceStatus(requirement)),
      `absenceStatus has no reading for "${requirement}"`,
    );
  }
});

check("core-browser's own verdict passes through below the cap", () => {
  assert.equal(classifyCoreBrowser({ status: "ok", message: "up" }, 3, 20).status, "ok");
  assert.equal(classifyCoreBrowser({ status: "warn", message: "VM off" }, 3, 20).status, "warn");
  assert.equal(classifyCoreBrowser({ status: "fail", message: "no binding" }, 3, 20).status, "fail");
});

check("a timeout is a failure, not a status of its own", () => {
  const result = classifyCoreBrowser({ status: "timeout", message: "no answer in 10s" }, 3, 20);
  assert.equal(result.status, "fail");
  assert.ok(INTEGRATION_STATUSES.includes(result.status), "timeout leaked as its own status");
  assert.equal(result.message, "no answer in 10s", "the probe's own message must survive");
});

check("at the cap the browser is unavailable to this Worker, however healthy it is", () => {
  const atCap = classifyCoreBrowser({ status: "ok", message: "up" }, 20, 20);
  assert.equal(atCap.status, "warn", "a healthy core-browser at the cap still cannot take a job");
  assert.match(atCap.message, /cap of 20 is reached/);
  assert.equal(atCap.details.jobs_remaining, 0);
  // past the cap too, not only exactly at it
  assert.equal(classifyCoreBrowser({ status: "ok", message: "up" }, 25, 20).status, "warn");
  // and a broken core-browser at the cap is still a failure, not a warning
  assert.equal(classifyCoreBrowser({ status: "fail", message: "down" }, 20, 20).status, "fail");
});

check("one job below the cap is not the cap", () => {
  const result = classifyCoreBrowser({ status: "ok", message: "up" }, 19, 20);
  assert.equal(result.status, "ok");
  assert.equal(result.details.jobs_remaining, 1);
});

check("an unmeasured job count is null, never zero", () => {
  const unknown = classifyCoreBrowser({ status: "ok", message: "up" }, null, 20);
  assert.equal(unknown.details.jobs_today, null, "an unknown count must not read as 0 used");
  assert.equal(unknown.details.jobs_remaining, null, "nor as a full day of capacity left");
  assert.equal(unknown.status, "ok", "not knowing the count is not core-browser's fault");
  // and the cap is still reported, so a reader knows what the ceiling is
  assert.equal(unknown.details.daily_cap, 20);
});

check("the probe's own details survive classification", () => {
  const result = classifyCoreBrowser(
    { status: "warn", message: "guard tripped", details: { guard: { ok: false, state: "tripped" } } },
    2,
    20,
  );
  assert.deepEqual(result.details.guard, { ok: false, state: "tripped" });
});

check("every integration the brief asks for is declared, built or not", () => {
  const ids = INTEGRATION_DECLARATIONS.map((d) => d.id);
  for (const id of [
    "core_browser",
    "core_guardian",
    "postgres",
    "google_workspace",
    "spotify",
    "cloudflare_images",
    "reviews",
  ]) {
    assert.ok(ids.includes(id), `"${id}" is not declared, so its absence would read as nothing`);
  }
  assert.equal(new Set(ids).size, ids.length, "two declarations share an id");
});

check("every planned integration names the task that builds it", () => {
  for (const declaration of INTEGRATION_DECLARATIONS) {
    assert.ok(
      INTEGRATION_REQUIREMENTS.includes(declaration.requirement),
      `${declaration.id} has an undeclared requirement`,
    );
    if (declaration.requirement === "planned") {
      assert.match(
        declaration.task ?? "",
        /^cs-/,
        `${declaration.id} is planned but names no task, so the gap is not actionable`,
      );
    }
  }
});

check("every declaration says what it is for and how it is reached", () => {
  for (const declaration of INTEGRATION_DECLARATIONS) {
    assert.ok(declaration.purpose.length > 20, `${declaration.id} has no purpose a person can read`);
    assert.ok(declaration.transport.length > 0, `${declaration.id} does not say how it is reached`);
    assert.ok(declaration.label.length > 0, `${declaration.id} has no label`);
  }
});

check("the three probed integrations are the required ones", () => {
  const required = INTEGRATION_DECLARATIONS.filter((d) => d.requirement === "required").map((d) => d.id);
  assert.deepEqual(required.sort(), ["core_browser", "core_guardian", "postgres"]);
});

console.log(`selfcheck-integrations: ok (${passed} checks)`);
