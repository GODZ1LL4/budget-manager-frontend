import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/theme.css";

import { loadTheme, applyTheme } from "./theme/themeStore";
import App from "./App.jsx";

const persisted = loadTheme();
if (persisted) applyTheme(persisted);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
