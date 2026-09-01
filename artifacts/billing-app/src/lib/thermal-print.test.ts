import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  startThermalPrint,
  THERMAL_PRINT_MODE_CLASS,
  THERMAL_PRINT_STYLE,
  THERMAL_PRINT_STYLE_ID,
} from "./thermal-print";

type Listener = (...args: any[]) => void;

function createPrintEnvironment() {
  const windowListeners = new Map<string, Listener[]>();
  const mediaListeners = new Map<string, Listener[]>();
  const classes = new Set<string>();
  const styles = new Map<string, any>();
  let printCalls = 0;

  const style = {
    id: "",
    textContent: "",
    remove() {
      styles.delete(this.id);
    },
  };
  const document = {
    body: {
      classList: {
        add: (name: string) => classes.add(name),
        remove: (name: string) => classes.delete(name),
        contains: (name: string) => classes.has(name),
      },
    },
    head: {
      appendChild: (node: any) => styles.set(node.id, node),
    },
    createElement: () => ({ ...style }),
    getElementById: (id: string) => styles.get(id) ?? null,
  } as unknown as Document;

  const mediaQuery = {
    matches: false,
    addEventListener: (name: string, listener: Listener) => {
      mediaListeners.set(name, [...(mediaListeners.get(name) ?? []), listener]);
    },
    removeEventListener: (name: string, listener: Listener) => {
      mediaListeners.set(name, (mediaListeners.get(name) ?? []).filter((item) => item !== listener));
    },
    addListener: (listener: Listener) => {
      mediaListeners.set("legacy", [...(mediaListeners.get("legacy") ?? []), listener]);
    },
    removeListener: (listener: Listener) => {
      mediaListeners.set("legacy", (mediaListeners.get("legacy") ?? []).filter((item) => item !== listener));
    },
  } as unknown as MediaQueryList;

  const window = {
    matchMedia: () => mediaQuery,
    addEventListener: (name: string, listener: Listener) => {
      windowListeners.set(name, [...(windowListeners.get(name) ?? []), listener]);
    },
    removeEventListener: (name: string, listener: Listener) => {
      windowListeners.set(name, (windowListeners.get(name) ?? []).filter((item) => item !== listener));
    },
    print: () => {
      printCalls += 1;
    },
  } as unknown as Window;

  return {
    environment: { document, window },
    classes,
    styles,
    mediaListeners,
    windowListeners,
    get printCalls() {
      return printCalls;
    },
    dispatchAfterPrint() {
      for (const listener of windowListeners.get("afterprint") ?? []) listener();
    },
    dispatchMediaChange(matches: boolean) {
      mediaQuery.matches = matches;
      for (const listener of mediaListeners.get("change") ?? []) listener({ matches });
    },
  };
}

describe("thermal print lifecycle", () => {
  it("installs receipt mode before print and cleans up after preview closes", () => {
    const harness = createPrintEnvironment();
    const reasons: string[] = [];
    const session = startThermalPrint({
      environment: harness.environment,
      onFinished: (reason) => reasons.push(reason),
    });

    assert.equal(harness.printCalls, 1);
    assert.equal(harness.classes.has(THERMAL_PRINT_MODE_CLASS), true);
    assert.equal(harness.styles.has(THERMAL_PRINT_STYLE_ID), true);
    assert.match(harness.styles.get(THERMAL_PRINT_STYLE_ID).textContent, /size:\s*80mm auto/);
    assert.equal(session.isActive(), true);

    harness.dispatchAfterPrint();

    assert.equal(harness.classes.has(THERMAL_PRINT_MODE_CLASS), false);
    assert.equal(harness.styles.has(THERMAL_PRINT_STYLE_ID), false);
    assert.equal(session.isActive(), false);
    assert.deepEqual(reasons, ["afterprint"]);
  });

  it("cleans up when the print media query returns to screen", () => {
    const harness = createPrintEnvironment();
    const reasons: string[] = [];
    const session = startThermalPrint({
      environment: harness.environment,
      onFinished: (reason) => reasons.push(reason),
    });

    harness.dispatchMediaChange(false);

    assert.equal(session.isActive(), false);
    assert.deepEqual(reasons, ["media-query"]);
    assert.equal(harness.styles.has(THERMAL_PRINT_STYLE_ID), false);
  });

  it("cancels an older session before starting a replacement", () => {
    const harness = createPrintEnvironment();
    const firstReasons: string[] = [];
    const first = startThermalPrint({
      environment: harness.environment,
      onFinished: (reason) => firstReasons.push(reason),
    });
    const second = startThermalPrint({ environment: harness.environment });

    assert.equal(first.isActive(), false);
    assert.deepEqual(firstReasons, ["cancelled"]);
    assert.equal(second.isActive(), true);
    second.cancel();
    assert.equal(harness.classes.has(THERMAL_PRINT_MODE_CLASS), false);
  });

  it("removes mode and styles when the browser print call fails", () => {
    const harness = createPrintEnvironment();
    harness.environment.window.print = () => {
      throw new Error("print unavailable");
    };

    assert.throws(() => startThermalPrint({ environment: harness.environment }), /print unavailable/);
    assert.equal(harness.classes.has(THERMAL_PRINT_MODE_CLASS), false);
    assert.equal(harness.styles.has(THERMAL_PRINT_STYLE_ID), false);
  });
});

assert.match(THERMAL_PRINT_STYLE, /margin:\s*4mm 4mm 6mm/);