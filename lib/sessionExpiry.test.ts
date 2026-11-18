import assert from "node:assert/strict";
import test from "node:test";
import { isUnauthorizedError } from "./authStatus";
import {
  AUTH_401_LINK_ENABLED,
  CHEF_WATCHDOG_MS,
  SESSION_LATCH_TTL_MS,
  chefFailureUi,
  decideChefFailureAction,
  emitSessionExpired,
  handleHttpResponse,
  hasSessionExpired,
  payloadHasUnauthorized,
  reportAuthFailure,
  resetSessionExpired,
  sessionLatchKey,
  setSessionLatchKey,
  subscribeSessionExpired,
} from "./sessionExpiry";

const batchWith401 = [
  { result: { data: { json: { ok: true } } } },
  {
    error: {
      json: {
        message: "Please login (10001)",
        code: -32001,
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      },
    },
  },
];

test("flag defaults OFF (link reporting is a no-op unless explicitly enabled)", () => {
  assert.equal(process.env.EXPO_PUBLIC_AUTH_401_LINK ?? "", "");
  assert.equal(AUTH_401_LINK_ENABLED, false);
});

test("batch 401 emits the session-expired event exactly once", () => {
  resetSessionExpired();
  const events: string[] = [];
  const unsubscribe = subscribeSessionExpired((info) => events.push(info.source));

  assert.equal(payloadHasUnauthorized(batchWith401), true);
  assert.equal(reportAuthFailure(batchWith401, "batch"), true);
  assert.equal(reportAuthFailure(batchWith401, "batch"), false);
  assert.deepEqual(events, ["batch"]);
  assert.equal(hasSessionExpired(), true);

  unsubscribe();
  resetSessionExpired();
});

test("flag OFF: 401 only logs the [auth401] baseline, never emits an event", () => {
  resetSessionExpired();
  let events = 0;
  const unsubscribe = subscribeSessionExpired(() => {
    events += 1;
  });
  const warns: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warns.push(args.map(String).join(" "));
  };
  try {
    const emitted = handleHttpResponse(
      401,
      { data: { code: "UNAUTHORIZED", httpStatus: 401 } },
      "/api/v1/trpc",
      "http",
    );
    assert.equal(emitted, false);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warns.length, 1);
  assert.equal(
    warns[0],
    "[auth401] path=/api/v1/trpc code=UNAUTHORIZED flag=off",
  );
  assert.equal(events, 0);
  assert.equal(hasSessionExpired(), false);
  unsubscribe();
});

test("latch key includes family id: switching family clears the latch", () => {
  resetSessionExpired();
  const familyA = sessionLatchKey({ userId: 7, familyId: "100" });
  const familyB = sessionLatchKey({ userId: 7, familyId: "200" });
  assert.notEqual(familyA, familyB);

  setSessionLatchKey(familyA);
  assert.equal(emitSessionExpired({ source: "family-a" }), true);
  assert.equal(hasSessionExpired(), true);

  assert.equal(setSessionLatchKey(familyB), true);
  assert.equal(hasSessionExpired(), false);
});

test("any non-401 success response clears the latch immediately", () => {
  resetSessionExpired();
  setSessionLatchKey(sessionLatchKey({ userId: 7, familyId: "100" }));
  assert.equal(emitSessionExpired({ source: "batch" }), true);
  assert.equal(hasSessionExpired(), true);

  const emitted = handleHttpResponse(
    200,
    [{ result: { data: { json: { ok: true } } } }],
    "/api/v1/trpc",
    "batch",
  );
  assert.equal(emitted, false);
  assert.equal(hasSessionExpired(), false);
});

test("TTL is 30s and never shorter than the 20s chef watchdog", () => {
  assert.equal(CHEF_WATCHDOG_MS, 20_000);
  assert.equal(SESSION_LATCH_TTL_MS, 30_000);
  assert.ok(SESSION_LATCH_TTL_MS >= CHEF_WATCHDOG_MS);
});

test("AI Chef UNAUTHORIZED stops the spinner and shows the login prompt", () => {
  const unauthorized = { data: { code: "UNAUTHORIZED", httpStatus: 401 } };
  const action = decideChefFailureAction(unauthorized);
  assert.equal(action, "login");
  assert.deepEqual(chefFailureUi(action), { stopSpinner: true, showLoginPrompt: true });
});

test("AbortError / timeout is retryable: no login prompt, no logout, no token clear", () => {
  resetSessionExpired();
  let events = 0;
  const unsubscribe = subscribeSessionExpired(() => {
    events += 1;
  });

  const abort = Object.assign(new Error("Aborted"), { name: "AbortError" });
  const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });

  for (const error of [abort, timeout]) {
    assert.equal(isUnauthorizedError(error), false);
    assert.equal(decideChefFailureAction(error), "retry");
    assert.deepEqual(chefFailureUi("retry"), { stopSpinner: true, showLoginPrompt: false });
    assert.equal(reportAuthFailure(error, "chat"), false);
  }

  assert.equal(events, 0);
  assert.equal(hasSessionExpired(), false);
  unsubscribe();
});
