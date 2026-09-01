export const THERMAL_PRINT_MODE_CLASS = "receipt-mode";
export const THERMAL_PRINT_STYLE_ID = "mobilinq-thermal-print-style";

export const THERMAL_PRINT_STYLE = `
@page {
  size: 80mm auto;
  margin: 4mm 4mm 6mm;
}
`;

type PrintFinishedReason = "afterprint" | "media-query" | "cancelled" | "error";

interface ThermalPrintEnvironment {
  document: Document;
  window: Window;
}

interface ThermalPrintOptions {
  onFinished?: (reason: PrintFinishedReason) => void;
  environment?: ThermalPrintEnvironment;
}

export interface ThermalPrintSession {
  cancel: () => void;
  isActive: () => boolean;
}

let activeSession: ThermalPrintSession | null = null;

/**
 * Starts a browser-managed thermal print preview and keeps receipt mode active
 * until the browser reports that preview was completed or cancelled.
 */
export function startThermalPrint(options: ThermalPrintOptions = {}): ThermalPrintSession {
  const targetWindow = options.environment?.window ?? globalThis.window;
  const targetDocument = options.environment?.document ?? globalThis.document;

  if (!targetWindow || !targetDocument?.body || !targetDocument.head) {
    throw new Error("Printing is not available in this browser.");
  }
  if (typeof targetWindow.print !== "function") {
    throw new Error("Printing is not available in this browser.");
  }

  activeSession?.cancel();
  targetDocument.getElementById(THERMAL_PRINT_STYLE_ID)?.remove();

  const style = targetDocument.createElement("style");
  style.id = THERMAL_PRINT_STYLE_ID;
  style.textContent = THERMAL_PRINT_STYLE;

  let finished = false;
  let printRequested = false;
  let mediaQuery: MediaQueryList | null = null;

  let session: ThermalPrintSession;

  const finish = (reason: PrintFinishedReason) => {
    if (finished) return;
    finished = true;
    targetWindow.removeEventListener("afterprint", onAfterPrint);

    if (mediaQuery) {
      mediaQuery.removeEventListener?.("change", onMediaQueryChange);
      mediaQuery.removeListener?.(onMediaQueryChange);
    }

    targetDocument.body.classList.remove(THERMAL_PRINT_MODE_CLASS);
    style.remove();
    if (activeSession === session) activeSession = null;
    options.onFinished?.(reason);
  };

  const onAfterPrint = () => finish("afterprint");
  const onMediaQueryChange = (event: MediaQueryListEvent) => {
    if (printRequested && !event.matches) finish("media-query");
  };

  targetDocument.head.appendChild(style);
  targetDocument.body.classList.add(THERMAL_PRINT_MODE_CLASS);
  targetWindow.addEventListener("afterprint", onAfterPrint);

  if (typeof targetWindow.matchMedia === "function") {
    mediaQuery = targetWindow.matchMedia("print");
    mediaQuery.addEventListener?.("change", onMediaQueryChange);
    mediaQuery.addListener?.(onMediaQueryChange);
  }

  session = {
    cancel: () => finish("cancelled"),
    isActive: () => !finished,
  };
  activeSession = session;

  try {
    printRequested = true;
    targetWindow.print();
  } catch (error) {
    finish("error");
    throw error;
  }

  return session;
}