import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-config";

setBaseUrl(getApiBaseUrl());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then((registration) => {
        const announceIfWaiting = () => {
          if (registration.waiting) {
            window.dispatchEvent(new Event("mobilinq:service-worker-update"));
          }
        };

        announceIfWaiting();
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              announceIfWaiting();
            }
          });
        });
      })
      .catch(() => {
        // The app remains usable without PWA updates if registration is unavailable.
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
