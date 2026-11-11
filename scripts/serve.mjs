import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = await realpath(resolve(import.meta.dirname, ".."));
const port = Number(process.env.PORT ?? 4173);
// 默认监听所有网卡，便于发布到云端 / 局域网访问；
// 只想本机访问时设置 HOST=127.0.0.1。
const host = process.env.HOST ?? "0.0.0.0";
const allowedMethods = new Set(["GET", "HEAD"]);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function isInsideRoot(filePath) {
  const normalize = (value) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  const normalizedRoot = normalize(root);
  const normalizedPath = normalize(filePath);
  return (
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(`${normalizedRoot}${sep}`)
  );
}

async function resolveRequestPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    const error = new Error("Malformed path");
    error.code = "BAD_REQUEST";
    throw error;
  }

  if (
    decoded.includes("\0") ||
    decoded.split(/[\\/]+/).some((segment) => segment === "..")
  ) {
    return null;
  }

  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const absolutePath = resolve(root, relativePath);
  const realPath = await realpath(absolutePath);

  if (!isInsideRoot(realPath)) {
    return null;
  }

  const fileStats = await stat(realPath);
  if (!fileStats.isDirectory()) {
    return { filePath: realPath, fileStats };
  }

  const indexPath = await realpath(resolve(realPath, "index.html"));
  if (!isInsideRoot(indexPath)) {
    return null;
  }

  return { filePath: indexPath, fileStats: await stat(indexPath) };
}

const server = createServer(async (request, response) => {
  try {
    if (!allowedMethods.has(request.method)) {
      response.writeHead(405, {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("Method not allowed");
      return;
    }

    const rawPath = (request.url ?? "/").split("?")[0] || "/";
    const resolved = await resolveRequestPath(rawPath);

    if (!resolved) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const { filePath } = resolved;

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    const status =
      error.code === "BAD_REQUEST" ? 400 : error.code === "ENOENT" ? 404 : 500;
    response.writeHead(status, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(status === 404 ? "Not found" : "Internal server error");
  }
});

server.listen(port, host, () => {
  const actualPort = server.address().port;
  // 固定打印 127.0.0.1，保证本地预览提示与 tests/server.test.js 的端口解析一致
  console.log(`Growth dashboard: http://127.0.0.1:${actualPort}`);
  if (host !== "127.0.0.1") {
    console.log(`Network: listening on ${host}:${actualPort} (HOST=127.0.0.1 to restrict)`);
  }
});
