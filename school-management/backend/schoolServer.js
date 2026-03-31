const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { handleStudentsRoute } = require("./routes/students");
const { handleResultsRoute } = require("./routes/results");
const { generateReportCardPdf } = require("../pdf/generateReport");

const HOST = process.env.SCHOOL_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.SCHOOL_PORT || "4600", 10);
const MODULE_ROOT = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(MODULE_ROOT, "frontend");
const DATA_DIR = path.join(__dirname, "runtime-data");
const GENERATED_DIR = path.join(__dirname, "generated-reports");
const CONTENT_TYPES = {
    ".html": "text/html; charset=UTF-8",
    ".css": "text/css; charset=UTF-8",
    ".js": "text/javascript; charset=UTF-8",
    ".json": "application/json; charset=UTF-8",
    ".pdf": "application/pdf"
};

function ensureRuntimeDirectories() {
    [DATA_DIR, GENERATED_DIR].forEach((targetPath) => {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
    });
}

function getDataFilePath(fileName) {
    return path.join(DATA_DIR, fileName);
}

function readJsonFile(fileName, fallbackValue) {
    const filePath = getDataFilePath(fileName);

    if (!fs.existsSync(filePath)) {
        return fallbackValue;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        console.warn(`Could not read ${fileName}:`, error);
        return fallbackValue;
    }
}

function writeJsonFile(fileName, value) {
    const filePath = getDataFilePath(fileName);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function createStore() {
    return {
        getStudents() {
            return readJsonFile("students.json", []);
        },
        saveStudents(students) {
            writeJsonFile("students.json", students);
        },
        getResults() {
            return readJsonFile("results.json", []);
        },
        saveResults(results) {
            writeJsonFile("results.json", results);
        },
        getStudentById(studentId) {
            return this.getStudents().find((student) => student.id === studentId) || null;
        }
    };
}

async function parseRequestBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(chunk);
    }

    if (chunks.length === 0) {
        return {};
    }

    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "no-store"
    });
    response.end(payload);
}

function getContentType(filePath) {
    return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safeJoin(basePath, requestPath) {
    const normalizedPath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const targetPath = path.join(basePath, normalizedPath);
    return targetPath.startsWith(basePath) ? targetPath : null;
}

function serveFile(response, filePath) {
    fs.readFile(filePath, (error, fileBuffer) => {
        if (error) {
            sendText(response, error.code === "ENOENT" ? 404 : 500, error.code === "ENOENT" ? "Not found" : "Server error");
            return;
        }

        response.writeHead(200, {
            "Content-Type": getContentType(filePath),
            "Cache-Control": "no-store"
        });
        response.end(fileBuffer);
    });
}

function serveStatic(request, response, pathname) {
    if (pathname.startsWith("/generated-reports/")) {
        const reportPath = safeJoin(GENERATED_DIR, pathname.replace("/generated-reports/", ""));
        if (!reportPath) {
            sendText(response, 403, "Forbidden");
            return;
        }

        serveFile(response, reportPath);
        return;
    }

    const requestedFile = pathname === "/" ? "/schoolDashboard.html" : pathname;
    const staticFilePath = safeJoin(FRONTEND_DIR, requestedFile);

    if (!staticFilePath) {
        sendText(response, 403, "Forbidden");
        return;
    }

    serveFile(response, staticFilePath);
}

function buildDashboardSummary(store) {
    const students = store.getStudents();
    const reports = store.getResults();
    const classCount = new Set(students.map((student) => student.className).filter(Boolean)).size;
    const latestReport = reports[0] || null;

    return {
        students: students.length,
        classes: classCount,
        reports: reports.length,
        latestReport: latestReport
            ? {
                id: latestReport.id,
                studentName: latestReport.studentName,
                className: latestReport.className,
                term: latestReport.term,
                academicYear: latestReport.academicYear
            }
            : null
    };
}

function createServer() {
    ensureRuntimeDirectories();
    const store = createStore();

    return http.createServer(async (request, response) => {
        const currentUrl = new URL(request.url, `http://${HOST}:${PORT}`);
        const pathname = currentUrl.pathname;

        try {
            if (request.method === "GET" && pathname === "/api/dashboard") {
                sendJson(response, 200, {
                    success: true,
                    summary: buildDashboardSummary(store)
                });
                return;
            }

            const body = request.method === "POST" || request.method === "PUT"
                ? await parseRequestBody(request)
                : {};

            const routeContext = {
                request,
                response,
                pathname,
                query: currentUrl.searchParams,
                body,
                store,
                sendJson,
                frontendBaseUrl: `http://${HOST}:${PORT}`,
                generatedDir: GENERATED_DIR,
                generateReportCardPdf
            };

            if (await handleStudentsRoute(routeContext)) {
                return;
            }

            if (await handleResultsRoute(routeContext)) {
                return;
            }

            serveStatic(request, response, pathname);
        } catch (error) {
            console.error("School Management server error:", error);
            if (pathname.startsWith("/api/")) {
                sendJson(response, 500, {
                    success: false,
                    error: error.message || "School server error"
                });
                return;
            }

            sendText(response, 500, "School Management server error");
        }
    });
}

function startSchoolManagementServer() {
    const server = createServer();
    server.listen(PORT, HOST, () => {
        console.log(`School Management module running at http://${HOST}:${PORT}/schoolDashboard.html`);
    });
    return server;
}

if (require.main === module) {
    startSchoolManagementServer();
}

module.exports = {
    createServer,
    startSchoolManagementServer
};
