import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import app from "./dist/server/server.js";

const port = Number(process.env.PORT ?? 3000);
const clientDirectory = resolve("dist/client");
const configuredApiHost = process.env.VITE_API_HOST;
const apiHost = configuredApiHost
  ? configuredApiHost.includes(".")
    ? configuredApiHost
    : `${configuredApiHost}.onrender.com`
  : null;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

async function serveAsset(pathname, response) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const filePath = resolve(clientDirectory, `.${decodedPath}`);
  if (!filePath.startsWith(`${clientDirectory}${sep}`)) return false;

  try {
    if (!(await stat(filePath)).isFile()) return false;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": decodedPath.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300",
  });
  if (response.req.method === "HEAD") {
    response.end();
  } else {
    await pipeline(createReadStream(filePath), response);
  }
  return true;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const requestUrl = new URL(incoming.url ?? "/", `http://${incoming.headers.host}`);
    if (await serveAsset(requestUrl.pathname, outgoing)) return;

    if (apiHost && requestUrl.pathname.startsWith("/api/")) {
      const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, `https://${apiHost}`);
      const headers = new Headers();
      const excludedHeaders = new Set([
        "connection",
        "content-length",
        "host",
        "keep-alive",
        "proxy-connection",
        "transfer-encoding",
      ]);
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined && !excludedHeaders.has(name.toLowerCase())) {
          headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
      }

      const method = incoming.method ?? "GET";
      const result = await fetch(targetUrl, {
        method,
        headers,
        ...(method === "GET" || method === "HEAD"
          ? {}
          : { body: Readable.toWeb(incoming), duplex: "half" }),
        redirect: "manual",
      });
      const responseHeaders = Object.fromEntries(result.headers);
      delete responseHeaders.connection;
      delete responseHeaders["content-encoding"];
      delete responseHeaders["content-length"];
      delete responseHeaders["keep-alive"];
      delete responseHeaders["transfer-encoding"];
      const cookies = result.headers.getSetCookie();
      if (cookies.length > 0) responseHeaders["set-cookie"] = cookies;
      outgoing.writeHead(result.status, responseHeaders);
      if (result.body) await pipeline(Readable.fromWeb(result.body), outgoing);
      else outgoing.end();
      return;
    }

    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }

    const method = incoming.method ?? "GET";
    const request = new Request(requestUrl, {
      method,
      headers,
      ...(method === "GET" || method === "HEAD"
        ? {}
        : { body: Readable.toWeb(incoming), duplex: "half" }),
    });
    const result = await app.fetch(request, process.env, {});
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) await pipeline(Readable.fromWeb(result.body), outgoing);
    else outgoing.end();
  } catch (error) {
    console.error("Frontend server request failed", error);
    if (!outgoing.headersSent) {
      outgoing.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      outgoing.end("Internal Server Error");
    } else {
      outgoing.destroy(error);
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AdaptIQ frontend listening on port ${port}`);
});
