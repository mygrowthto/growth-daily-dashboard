import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let serverProcess;
let origin;

before(async () => {
  serverProcess = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for the static server")),
      5000
    );
    let output = "";

    serverProcess.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
    serverProcess.once("error", reject);
  });
});

after(() => {
  serverProcess?.kill();
});

function requestRawPath(path) {
  const target = new URL(origin);
  return new Promise((resolve, reject) => {
    const clientRequest = request(
      {
        hostname: target.hostname,
        port: target.port,
        path,
        method: "GET"
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      }
    );
    clientRequest.once("error", reject);
    clientRequest.end();
  });
}

test("static server serves the app and JSON with correct types", async () => {
  const homeResponse = await fetch(`${origin}/`);
  const dataResponse = await fetch(`${origin}/data/daily-data.json`);

  assert.equal(homeResponse.status, 200);
  assert.match(homeResponse.headers.get("content-type"), /text\/html/);
  assert.equal(dataResponse.status, 200);
  assert.match(dataResponse.headers.get("content-type"), /application\/json/);
});

test("static server supports HEAD but rejects unsupported methods", async () => {
  const headResponse = await fetch(`${origin}/`, { method: "HEAD" });
  const postResponse = await fetch(`${origin}/`, { method: "POST" });

  assert.equal(headResponse.status, 200);
  assert.equal(postResponse.status, 405);
  assert.match(postResponse.headers.get("allow"), /GET/);
});

test("static server rejects malformed and traversal paths", async () => {
  const malformedStatus = await requestRawPath("/%E0%A4%A");
  const traversalStatus = await requestRawPath("/%2e%2e/package.json");

  assert.equal(malformedStatus, 400);
  assert.equal(traversalStatus, 403);
});
