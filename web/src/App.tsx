import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ChatNotifyBridge } from "./components/ChatNotifyBridge";
import { HomePage } from "./pages/HomePage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <ChatNotifyBridge />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/karta" element={<MapPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
