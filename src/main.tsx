// src/main.tsx
import "@/boot/supabase-rest-guard";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
