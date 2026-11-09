import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ChatNotifyBridge } from "./components/ChatNotifyBridge";
import { QuickCatch } from "./components/QuickCatch";
import { HomePage } from "./pages/HomePage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { HelpPage } from "./pages/HelpPage";
import { LegalPage } from "./pages/LegalPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <ChatNotifyBridge />
      <QuickCatch />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/karta" element={<MapPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/hjalp" element={<HelpPage />} />
        <Route path="/integritet" element={<LegalPage />} />
        <Route path="/villkor" element={<LegalPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
