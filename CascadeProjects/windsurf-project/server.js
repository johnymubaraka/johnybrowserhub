const http = require("http");
const fs = require("fs");
const path = require("path");
const { askAI } = require("./ai");

const DATA_DIR = path.join(__dirname, "data");
const HISTORY_FILE = path.join(DATA_DIR, "chat-history.json");
const STATIC_CONTENT_TYPES = {
    ".html": "text/html; charset=UTF-8",
    ".js": "text/javascript; charset=UTF-8",
    ".css": "text/css; charset=UTF-8",
    ".json": "application/json; charset=UTF-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon"
};

function ensureDataStore() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(HISTORY_FILE)) {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ sessions: {} }, null, 2));
    }
}

function readHistoryStore() {
    ensureDataStore();
    try {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    } catch {
        return { sessions: {} };
    }
}

function writeHistoryStore(store) {
    ensureDataStore();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(store, null, 2));
}

function getContentType(filePath) {
    return STATIC_CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function parseRequestBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(chunk);
    }

    if (!chunks.length) {
        return {};
    }

    const raw = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(raw);
}

function json(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(payload));
}

async function handleChat(body) {
    const history = Array.isArray(body.history) ? body.history : [];
    const message = `${body.message || ""}`.trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    
    // Simple fallback response without AI for now
    const finalAnswer = `Hello! I received your message: "${message}". The AI chatbot feature is currently disabled for stability, but you can still use all the VPN and browser download features. Thank you for your understanding!`;
    
    const store = readHistoryStore();
    store.sessions[body.sessionId || `session-${Date.now()}`] = {
        updatedAt: Date.now(),
        prompt: message,
        history: history.slice(-12)
    };
    writeHistoryStore(store);

    return {
        answer: finalAnswer,
        references: []
    };
}

function serveStatic(request, response) {
    const requestedPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
    const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(__dirname, safePath);

    if (!filePath.startsWith(__dirname)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            response.writeHead(error.code === "ENOENT" ? 404 : 500);
            response.end(error.code === "ENOENT" ? "Not found" : "Server error");
            return;
        }

        response.writeHead(200, {
            "Content-Type": getContentType(filePath),
            "Cache-Control": "no-store"
        });
        response.end(data);
    });
}

function createAppServer() {
    ensureDataStore();

    const server = http.createServer(async (request, response) => {
        try {
            if (request.method === "POST" && request.url === "/api/chat") {
                const body = await parseRequestBody(request);
                json(response, 200, await handleChat(body));
                return;
            }

            serveStatic(request, response);
        } catch (error) {
            json(response, 500, {
                error: error.message || "Unexpected server error"
            });
        }
    });

    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            resolve({
                server,
                url: `http://localhost:${address.port}/`
            });
        });
    });
}

module.exports = {
    createAppServer
};
