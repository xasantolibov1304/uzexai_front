import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LangProvider } from "./i18n.jsx";
import Chat from "./Chat.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LangProvider>
      <Chat />
    </LangProvider>
  </StrictMode>
);
