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
  return (
    <div onClick={navigate}>
      <div
        role="note"
        style={{
          padding: "12px 20px",
          background: "#293c2d",
          color: "white",
          fontSize: 13,
        }}
      >
        Offline preview — live AWS analysis is unavailable in this file.{" "}
        <a
          href="https://rescue.kanexi.me"
          style={{ color: "white", textDecoration: "underline" }}
        >
          Open the online app
        </a>
      </div>
      {demo ? <DemoApp liveAgentEnabled={false} /> : <Welcome />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Standalone />);
