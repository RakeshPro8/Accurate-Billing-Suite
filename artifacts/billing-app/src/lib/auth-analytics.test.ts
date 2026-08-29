import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  trackEmployeeAuthOutcome,
  trackEvent,
  type EmployeeAuthOutcome,
} from "./analytics";
import {
  classifySetupError,
  classifySignInError,
} from "./employee-auth-outcomes";

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    globalThis.window = originalWindow;
  }
});

describe("employee authentication analytics", () => {
  it("emits only aggregate flow and outcome fields for sign-in and setup", () => {
    const events: Array<{ name: string; data?: Record<string, unknown> }> = [];
    globalThis.window = {
      umami: {
        track(name, data) {
          events.push({ name, data });
        },
      },
    };

    const outcomes: EmployeeAuthOutcome[] = [
      "success",
      "invalid_input",
      "invalid_pin",
      "inactive_account",
      "account_not_found",
      "throttled",
      "setup_already_complete",
      "error",
    ];
    for (const outcome of outcomes) {
      trackEmployeeAuthOutcome("sign_in", outcome);
      trackEmployeeAuthOutcome("setup", outcome);
    }

    assert.equal(events.length, outcomes.length * 2);
    for (const event of events) {
      assert.equal(event.name, "employee_auth_outcome");
      assert.deepEqual(Object.keys(event.data ?? {}).sort(), ["flow", "outcome"]);
      assert.ok(event.data?.flow === "sign_in" || event.data?.flow === "setup");
      assert.ok(outcomes.includes(event.data?.outcome as EmployeeAuthOutcome));
      assert.equal(JSON.stringify(event.data).includes("12345678"), false);
      assert.equal(JSON.stringify(event.data).includes("employee@example.com"), false);
      assert.equal(JSON.stringify(event.data).includes("Incorrect PIN."), false);
    }
  });

  it("does nothing when the analytics tracker is unavailable", () => {
    globalThis.window = {};

    assert.doesNotThrow(() => {
      trackEmployeeAuthOutcome("sign_in", "success");
      trackEmployeeAuthOutcome("setup", "setup_already_complete");
    });
  });

  it("does not let a throwing analytics tracker affect auth outcome tracking", () => {
    globalThis.window = {
      umami: {
        track() {
          throw new Error("tracker failed with employee@example.com PIN 12345678");
        },
      },
    };

    assert.doesNotThrow(() => {
      trackEvent("employee_auth_outcome", {
        flow: "sign_in",
        outcome: "success",
      });
      trackEmployeeAuthOutcome("setup", "error");
    });
  });
});

describe("employee authentication outcome classification", () => {
  it("maps sign-in HTTP failures to fixed aggregate categories", () => {
    const cases: Array<[number, EmployeeAuthOutcome]> = [
      [400, "invalid_input"],
      [401, "invalid_pin"],
      [403, "inactive_account"],
      [404, "account_not_found"],
      [429, "throttled"],
      [500, "error"],
    ];

    for (const [status, expected] of cases) {
      assert.equal(classifySignInError({ status, message: "private failure detail" }), expected);
    }
    assert.equal(classifySignInError(new Error("private failure detail")), "error");
    assert.equal(classifySignInError({ status: "401", message: "private failure detail" }), "error");
  });

  it("maps setup HTTP failures, including the setup conflict, to fixed categories", () => {
    const cases: Array<[number, EmployeeAuthOutcome]> = [
      [400, "invalid_input"],
      [409, "setup_already_complete"],
      [401, "error"],
      [403, "error"],
      [429, "error"],
      [500, "error"],
    ];

    for (const [status, expected] of cases) {
      assert.equal(classifySetupError({ status, message: "private failure detail" }), expected);
    }
  });
});