import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { ClientDetail } from "./pages/ClientDetail";
import { Appointments } from "./pages/Appointments";
import { Scraper } from "./pages/Scraper";
import { Kanban } from "./pages/Kanban";
import { WebAnalytics } from "./pages/WebAnalytics";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/scraper" element={<Scraper />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/analytics" element={<WebAnalytics />} />
      </Route>
    </Routes>
  );
}
