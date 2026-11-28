import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import defaultCasesHandler from "../frontend/api/cases/index.js";
import defaultConversationsHandler from "../frontend/api/conversations/index.js";
import defaultOrgHandler from "../frontend/api/org/index.js";
import defaultAdminHandler from "../frontend/api/admin/index.js";

console.log("=== Vercel Serverless Function Consolidation Verification ===");

// 1. Verify Function Count
const apiDir = path.resolve("frontend/api");
function getJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === "_lib") continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getJsFiles(fullPath));
    } else if (file.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

const apiFiles = getJsFiles(apiDir);
console.log(`\nFound ${apiFiles.length} serverless functions:`);
apiFiles.forEach((f) => console.log(`  - ${path.relative(process.cwd(), f)}`));

assert.ok(
  apiFiles.length <= 12,
  `Expected <= 12 serverless functions for Vercel Hobby, found ${apiFiles.length}`
);
console.log(`\n✓ Serverless function count (${apiFiles.length}) is <= 12!`);

// 2. Verify vercel.json rewrites
const vercelConfig = JSON.parse(fs.readFileSync("frontend/vercel.json", "utf-8"));
assert.ok(Array.isArray(vercelConfig.rewrites), "vercel.json must define rewrites array");
const rewriteSources = vercelConfig.rewrites.map((r) => r.source);
console.log("\nVercel rewrites configured:", rewriteSources);

assert.ok(rewriteSources.includes("/api/cases/notes"), "Missing rewrite for /api/cases/notes");
assert.ok(rewriteSources.includes("/api/conversations/messages"), "Missing rewrite for /api/conversations/messages");
assert.ok(rewriteSources.includes("/api/org/apply"), "Missing rewrite for /api/org/apply");
assert.ok(rewriteSources.includes("/api/org/list-public"), "Missing rewrite for /api/org/list-public");
assert.ok(rewriteSources.includes("/api/admin/notices"), "Missing rewrite for /api/admin/notices");
assert.ok(rewriteSources.includes("/api/admin/organizations"), "Missing rewrite for /api/admin/organizations");
console.log("✓ All 6 required rewrites present in frontend/vercel.json!");

// Helper to create mock req/res
function createMockReqRes({ method = "GET", url = "/", headers = {}, body = null } = {}) {
  const req = {
    method,
    url,
    headers: { ...headers, host: "localhost" },
    body,
    [Symbol.asyncIterator]: async function* () {
      if (body) {
        yield Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
      }
    },
  };

  let responseData = null;
  const resHeaders = {};

  const res = {
    statusCode: 200,
    setHeader: (k, v) => { resHeaders[k.toLowerCase()] = v; },
    getHeader: (k) => resHeaders[k.toLowerCase()],
    status(c) { this.statusCode = c; return this; },
    json(data) { responseData = data; return this; },
    end(chunk) {
      if (chunk && !responseData) {
        try { responseData = JSON.parse(chunk.toString()); }
        catch { responseData = chunk.toString(); }
      }
    },
    getStatusCode() { return this.statusCode; },
    getBody() { return responseData; },
  };

  return { req, res };
}

// 3. Test Routing Dispatchers
console.log("\nVerifying default export dispatchers:");

// A. Org Dispatcher
// GET /api/org/list-public
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/org/list-public" });
  await defaultOrgHandler(req, res);
  // Unauthenticated / mocked without firestore gives either 200 or 500 (not 404 or 405)
  assert.notEqual(res.getStatusCode(), 404, "Org handler should route /api/org/list-public");
  assert.notEqual(res.getStatusCode(), 405, "GET /api/org/list-public should not be 405");
  console.log("✓ Org dispatcher correctly routes /api/org/list-public");
}
// POST /api/org/apply with invalid JSON body gives 400 (not 404/405)
{
  const { req, res } = createMockReqRes({ method: "POST", url: "/api/org/apply", body: {} });
  await defaultOrgHandler(req, res);
  assert.equal(res.getStatusCode(), 400, "POST /api/org/apply without data returns 400 validation error");
  console.log("✓ Org dispatcher correctly routes /api/org/apply");
}

// B. Cases Dispatcher
// GET /api/cases without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/cases" });
  await defaultCasesHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/cases without token returns 401");
  console.log("✓ Cases dispatcher correctly routes /api/cases");
}
// GET /api/cases/notes without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/cases/notes" });
  await defaultCasesHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/cases/notes without token returns 401");
  console.log("✓ Cases dispatcher correctly routes /api/cases/notes");
}
// Rewritten GET /api/cases?sub=notes without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/cases?sub=notes" });
  await defaultCasesHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/cases?sub=notes without token returns 401");
  console.log("✓ Cases dispatcher correctly routes /api/cases?sub=notes");
}

// C. Conversations Dispatcher
// GET /api/conversations without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/conversations" });
  await defaultConversationsHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/conversations without token returns 401");
  console.log("✓ Conversations dispatcher correctly routes /api/conversations");
}
// GET /api/conversations/messages without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/conversations/messages" });
  await defaultConversationsHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/conversations/messages without token returns 401");
  console.log("✓ Conversations dispatcher correctly routes /api/conversations/messages");
}
// Rewritten GET /api/conversations?sub=messages without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/conversations?sub=messages" });
  await defaultConversationsHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/conversations?sub=messages without token returns 401");
  console.log("✓ Conversations dispatcher correctly routes /api/conversations?sub=messages");
}

// D. Admin Dispatcher
// GET /api/admin/notices without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/admin/notices" });
  await defaultAdminHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/admin/notices without token returns 401");
  console.log("✓ Admin dispatcher correctly routes /api/admin/notices");
}
// GET /api/admin/organizations without token gives 401
{
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/admin/organizations" });
  await defaultAdminHandler(req, res);
  assert.equal(res.getStatusCode(), 401, "GET /api/admin/organizations without token returns 401");
  console.log("✓ Admin dispatcher correctly routes /api/admin/organizations");
}

console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");
