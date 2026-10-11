import { createRoot } from "react-dom/client";
import RelayDashboard from "./components/relay/RelayDashboard";
import "./app/globals.css";
createRoot(document.getElementById("root")!).render(<RelayDashboard />);
