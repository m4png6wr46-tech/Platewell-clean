import React from "react";
import ReactDOM from "react-dom/client";
import PlatewellApp from "./App.jsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PlatewellApp />
  </React.StrictMode>
);