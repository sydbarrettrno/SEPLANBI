import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import "./styles.css";
import "./indicator-enhancements.css";
import "./flow-audit.css";
import "./executive-reference-v2.css";
import "./ux-security-v1.css";
import "./category-filter.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
