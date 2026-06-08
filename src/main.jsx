import React from "react";
import { createRoot } from "react-dom/client";
import FocacciaBuildSheet from "../focaccia-build-sheet.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FocacciaBuildSheet />
  </React.StrictMode>
);
