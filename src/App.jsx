import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import ChatPage from "./pages/ChatPage";
import Dashboard from "./pages/Dashboard";
import Deals from "./pages/Deals";
import DealDetail from "./pages/DealDetail";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Participants from "./pages/Participants";
import ParticipantDetail from "./pages/ParticipantDetail";
import Brokers from "./pages/Brokers";
import BrokerDetail from "./pages/BrokerDetail";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="deals" element={<Deals />} />
        <Route path="deals/:id" element={<DealDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:name" element={<ProductDetail />} />
        <Route path="participants" element={<Participants />} />
        <Route path="participants/:inn" element={<ParticipantDetail />} />
        <Route path="brokers" element={<Brokers />} />
        <Route path="brokers/:code" element={<BrokerDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
