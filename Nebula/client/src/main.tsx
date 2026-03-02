import { Buffer as BufferPolyfill } from "buffer";

if (typeof window !== "undefined" && typeof window.Buffer === "undefined") {
  window.Buffer = BufferPolyfill;
  window.global = window.globalThis;
  window.process = window.process || {
    env: {},
    browser: true,
  };
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGoogleAnalytics } from "./lib/analytics";

initGoogleAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
