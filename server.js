const fs = require("fs");
const http = require("http");
const path = require("path");
require("dotenv").config({ quiet: true });

const root = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

// Load navbar component once at startup
let navbarComponent = "";
try {
  navbarComponent = fs.readFileSync(path.join(root, "components", "navbar.html"), "utf8");
} catch (err) {
  console.warn("Warning: Could not load navbar component:", err.message);
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function publicConfig() {
  return JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/config") {
    return send(res, 200, publicConfig(), "application/json; charset=utf-8");
  }

  const cleanPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, cleanPath));
  if (!filePath.startsWith(root)) return send(res, 403, "Forbidden");

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    
    // Inject navbar component into HTML files
    if (path.extname(filePath) === ".html" && navbarComponent) {
      let html = data.toString();
      html = html.replace("<!-- navbar-placeholder -->", navbarComponent);
      return send(res, 200, html, mimeTypes[".html"]);
    }
    
    send(res, 200, data, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  });
}).listen(port, () => {
  console.log(`Hadith app running at http://localhost:${port}`);
});
