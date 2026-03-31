const http = require("http");
const fs = require("fs");
const path = require("path");
const { askAI, generateImage } = require("./ai");

const DATA_DIR = path.join(__dirname, "data");
const LOCAL_DEV_HOST = "localhost";
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

function sendApiError(response) {
    json(response, 500, {
        success: false,
        error: "Server error"
    });
}

function decodeDataUrl(dataUrl = "") {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) {
        return {
            mimeType: "text/plain",
            buffer: Buffer.from(dataUrl, "utf8")
        };
    }

    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], "base64")
    };
}

function summarizeUpload(name, mimeType, buffer) {
    if (mimeType.startsWith("text/") || /\.(txt|md|json|js|ts|html|css)$/i.test(name)) {
        const text = buffer.toString("utf8").slice(0, 7000);
        return {
            extractedText: text,
            summary: `Text file parsed: ${name}`
        };
    }

    if (mimeType.startsWith("image/")) {
        return {
            extractedText: `Image attachment received: ${name}. Use a vision-capable model to analyze the image contents in depth.`,
            summary: `Image ready for analysis: ${name}`
        };
    }

    if (/\.pdf$/i.test(name)) {
        return {
            extractedText: `PDF file received: ${name}. Add a dedicated PDF parser or OCR service for deep extraction.`,
            summary: `PDF received: ${name}`
        };
    }

    if (/\.(doc|docx)$/i.test(name)) {
        return {
            extractedText: `Document file received: ${name}. Add a DOCX parser for richer extraction.`,
            summary: `Document received: ${name}`
        };
    }

    return {
        extractedText: `File received: ${name}`,
        summary: `Attachment stored: ${name}`
    };
}

async function handleUpload(body) {
    const { mimeType, buffer } = decodeDataUrl(body.dataUrl || "");
    const summary = summarizeUpload(body.name || "attachment", body.mimeType || mimeType, buffer);
    return {
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: body.name || "attachment",
        mimeType: body.mimeType || mimeType,
        ...summary
    };
}

async function handleChat(body) {
    const message = `${body.message || ""}`.trim();
    const answer = await askAI(message);

    return {
        success: true,
        answer
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

            if (request.method === "POST" && request.url === "/api/generate-image") {
                try {
                    const body = await parseRequestBody(request);
                    console.log("Incoming image request:", body);

                    if (!body || !body.prompt) {
                        json(response, 400, {
                            success: false,
                            error: "Prompt is required"
                        });
                        return;
                    }

                    const prompt = `${body.prompt}`.trim();
                    console.log("Generating image for:", prompt);

                    const result = await generateImage(prompt);
                    console.log("Image result:", result);

                    if (!result || result.success === false || result.error || !result.image) {
                        json(response, 200, {
                            success: false,
                            error: result?.error || "Image generation failed"
                        });
                        return;
                    }

                    json(response, 200, {
                        success: true,
                        image: result.image,
                        text: result.text || "Image generated."
                    });
                    return;
                } catch (error) {
                    console.error("SERVER CRASH:", error);
                    json(response, 500, {
                        success: false,
                        error: "Internal server error"
                    });
                    return;
                }
            }

            if (request.method === "POST" && request.url === "/api/upload") {
                const body = await parseRequestBody(request);
                json(response, 200, await handleUpload(body));
                return;
            }

            serveStatic(request, response);
        } catch (error) {
            console.error("Server route error:", error);

            if (request.url?.startsWith("/api/")) {
                sendApiError(response);
                return;
            }

            response.writeHead(500, {
                "Content-Type": "text/plain; charset=UTF-8",
                "Cache-Control": "no-store"
            });
            response.end("Server error");
        }
    });

    server.on("clientError", (error, socket) => {
        console.error("HTTP client error:", error);
        if (!socket.destroyed) {
            socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        }
    });

    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, LOCAL_DEV_HOST, () => {
            const address = server.address();
            resolve({
                server,
                // Firebase Auth local testing is tied to the page origin.
                // Serving the app from localhost keeps Google sign-in compatible
                // with Firebase's authorized-domain rules for local development.
                url: `http://${LOCAL_DEV_HOST}:${address.port}/`
            });
        });
    });
}

module.exports = {
    createAppServer
};
