import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthContext";
import { bumpPwaIconCache } from "./pwaCacheBump";

void bumpPwaIconCache().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
});
