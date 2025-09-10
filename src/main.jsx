import React from "react";
import { createRoot } from "react-dom/client";
// import MonopolySolo from './MonopolySolo.jsx'   // bản solo
import OnlineMonopoly from "./OnlineMonopoly.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OnlineMonopoly />
  </React.StrictMode>
);
