import { useState, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";
import Welcome from "./app/page";
import DemoApp from "./components/DemoApp";
import "./app/globals.css";

function Standalone() {
  const [demo, setDemo] = useState(false);
  function navigate(event: MouseEvent<HTMLDivElement>) {
    const link =
      event.target instanceof Element ? event.target.closest("a") : null;
    const path = link?.getAttribute("href");
    if (path !== "/" && path !== "/demo") return;
    event.preventDefault();
    setDemo(path === "/demo");
    window.scrollTo(0, 0);
  }
  return <div onClick={navigate}>{demo ? <DemoApp /> : <Welcome />}</div>;
}

createRoot(document.getElementById("root")!).render(<Standalone />);
