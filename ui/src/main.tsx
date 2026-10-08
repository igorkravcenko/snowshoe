import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { installMapAccessTokenFromUrl } from "./session-token.ts";
import "./styles.css";

installMapAccessTokenFromUrl();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
