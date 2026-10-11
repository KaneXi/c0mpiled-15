import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../out");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    const relative =
      pathname === "/"
        ? "/index.html"
        : extname(pathname)
          ? pathname
          : `${pathname.replace(/\/$/, "")}.html`;
    const path = resolve(root, `.${relative}`);
    if (!path.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const content = await readFile(path);
    response.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  } catch {
    response
      .writeHead(404, { "Content-Type": "text/plain" })
      .end("Page not found.");
  }
});
server.listen(3008, "127.0.0.1", () =>
  console.log("Demo preview: http://localhost:3008"),
);
