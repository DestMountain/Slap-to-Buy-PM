import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installMockApi } from "./mockApi";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const isElectron = navigator.userAgent.includes("Electron");

if (!window.spank && !isElectron) {
  installMockApi();
}

root.render(
  <React.StrictMode>
    {window.spank ? <App /> : <PreloadError />}
  </React.StrictMode>
);

function PreloadError(): React.ReactElement {
  return (
    <main className="shell">
      <section className="preloadError">
        <strong>Preload failed</strong>
        <span>Electron IPC is unavailable. Restart the app after rebuilding.</span>
      </section>
    </main>
  );
}
