import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Buffer } from 'buffer';

// Polyfill Buffer for browser environment
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(<App />);
