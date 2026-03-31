const { app, BrowserWindow, dialog, ipcMain, Notification, shell, session } = require("electron");
const path = require("path");
const log = require("electron-log/main");
const { autoUpdater } = require("electron-updater");
const { askAI, generateImage, analyzeImage } = require("./ai");

const APP_ID = "com.johnybrowserhub.app";
const APP_NAME = "JohnyBrowserHub";
const APP_URL = process.env.JOHNY_BROWSERHUB_URL || "https://johnybrowserhub.web.app";
const APP_ORIGIN = new URL(APP_URL).origin;
const APP_HOST = new URL(APP_URL).host;
const FIREBASE_AUTH_ORIGIN = "https://johnybrowserhub.firebaseapp.com";
const FIREBASE_AUTH_HOST = "johnybrowserhub.firebaseapp.com";
const APP_SESSION_PARTITION = "persist:johnybrowserhub";
const SPLASH_MIN_DURATION_MS = 2500;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const WINDOW_BACKGROUND = "#07111d";
const ICON_PATH = path.join(__dirname, "assets", "app-icon.svg");

const ALLOWED_IN_APP_HOSTS = new Set([
    APP_HOST,
    FIREBASE_AUTH_HOST,
    "accounts.google.com",
    "apis.google.com"
]);
const TRUSTED_RENDERER_ORIGINS = new Set([
    APP_ORIGIN,
    FIREBASE_AUTH_ORIGIN
]);
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

let mainWindow = null;
let splashWindow = null;
let updateCheckPromise = null;
let updatePromptVisible = false;

log.initialize();
log.transports.file.level = "info";
log.transports.console.level = app.isPackaged ? "info" : "debug";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function wait(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function sendUpdateStatus(payload) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send("desktop:update-status", payload);
}

function showDesktopNotification(title, body) {
    if (!Notification.isSupported()) {
        return;
    }

    const notification = new Notification({
        title,
        body,
        icon: ICON_PATH
    });

    notification.show();
}

function getSafeExternalUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
        throw new Error("A valid URL is required.");
    }

    const parsedUrl = new URL(rawUrl);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) {
        throw new Error("Unsupported external URL protocol.");
    }

    return parsedUrl.toString();
}

function isTrustedRendererUrl(rawUrl) {
    try {
        const parsedUrl = new URL(rawUrl);
        return parsedUrl.protocol === "https:" && TRUSTED_RENDERER_ORIGINS.has(parsedUrl.origin);
    } catch (error) {
        return false;
    }
}

function shouldStayInsideApp(rawUrl) {
    try {
        const parsedUrl = new URL(rawUrl);
        return parsedUrl.protocol === "https:" && ALLOWED_IN_APP_HOSTS.has(parsedUrl.host);
    } catch (error) {
        return false;
    }
}

function buildFallbackPage(errorMessage = "The hosted app could not be loaded right now.") {
    const retryUrl = APP_URL.replace(/"/g, "&quot;");
    const safeMessage = `${errorMessage}`.replace(/[<>&"]/g, (character) => {
        switch (character) {
        case "<":
            return "&lt;";
        case ">":
            return "&gt;";
        case "&":
            return "&amp;";
        case "\"":
            return "&quot;";
        default:
            return character;
        }
    });

    return `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${APP_NAME} Connection Error</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #07111d;
            --panel: rgba(12, 23, 42, 0.94);
            --border: rgba(120, 194, 255, 0.22);
            --text: #eef7ff;
            --muted: #a7bfd9;
            --accent: #49a2ff;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 32px;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background:
                radial-gradient(circle at top right, rgba(73, 162, 255, 0.16), transparent 34%),
                radial-gradient(circle at bottom left, rgba(87, 220, 157, 0.12), transparent 28%),
                linear-gradient(180deg, #091320 0%, #07111d 100%);
            color: var(--text);
        }
        main {
            width: min(640px, 100%);
            padding: 32px;
            border-radius: 24px;
            border: 1px solid var(--border);
            background: var(--panel);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
        }
        h1 {
            margin: 0 0 12px;
            font-size: clamp(1.8rem, 4vw, 2.6rem);
        }
        p {
            margin: 0 0 16px;
            color: var(--muted);
            line-height: 1.7;
        }
        button, a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 46px;
            padding: 0 18px;
            border-radius: 14px;
            border: 0;
            background: var(--accent);
            color: white;
            text-decoration: none;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
        }
        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 22px;
        }
        .secondary {
            background: rgba(255, 255, 255, 0.08);
            color: var(--text);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        code {
            display: block;
            margin-top: 10px;
            padding: 14px 16px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.04);
            color: #dcecff;
            white-space: pre-wrap;
            word-break: break-word;
        }
    </style>
</head>
<body>
    <main>
        <h1>${APP_NAME} could not connect</h1>
        <p>The desktop shell is ready, but the hosted Firebase app did not load. Check the internet connection or verify the hosted site is available.</p>
        <code>${safeMessage}</code>
        <div class="actions">
            <button type="button" onclick="window.location.href='${retryUrl}'">Retry</button>
            <a class="secondary" href="${retryUrl}">Open Hosted App</a>
        </div>
    </main>
</body>
</html>`)}`;
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 980,
        minHeight: 700,
        frame: false,
        autoHideMenuBar: true,
        transparent: false,
        show: true,
        backgroundColor: WINDOW_BACKGROUND,
        icon: ICON_PATH,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    splashWindow.maximize();
    splashWindow.loadFile(path.join(__dirname, "splash.html"));
    splashWindow.on("closed", () => {
        splashWindow = null;
    });
}

function buildMainWindowOptions() {
    return {
        width: 1366,
        height: 900,
        minWidth: 1100,
        minHeight: 720,
        title: APP_NAME,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: WINDOW_BACKGROUND,
        icon: ICON_PATH,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            preload: path.join(__dirname, "preload.js"),
            partition: APP_SESSION_PARTITION,
            webviewTag: false,
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    };
}

function createMainWindow() {
    mainWindow = new BrowserWindow(buildMainWindowOptions());
    mainWindow.maximize();

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    const handleNavigation = (event, targetUrl) => {
        if (shouldStayInsideApp(targetUrl)) {
            return;
        }

        event.preventDefault();
        try {
            shell.openExternal(getSafeExternalUrl(targetUrl));
        } catch (error) {
            log.warn("Blocked unexpected navigation", {
                targetUrl,
                message: error.message
            });
        }
    };

    mainWindow.webContents.on("will-navigate", handleNavigation);
    mainWindow.webContents.on("will-redirect", handleNavigation);
    mainWindow.webContents.on("did-fail-load", async (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) {
            return;
        }

        log.error("Hosted app failed to load", {
            errorCode,
            errorDescription,
            validatedUrl
        });

        if (mainWindow && !mainWindow.isDestroyed()) {
            await mainWindow.loadURL(buildFallbackPage(errorDescription));
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (shouldStayInsideApp(url)) {
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: 520,
                    height: 720,
                    minWidth: 420,
                    minHeight: 560,
                    autoHideMenuBar: true,
                    backgroundColor: WINDOW_BACKGROUND,
                    parent: mainWindow,
                    modal: false,
                    show: true,
                    icon: ICON_PATH,
                    webPreferences: {
                        contextIsolation: true,
                        nodeIntegration: false,
                        sandbox: false,
                        partition: APP_SESSION_PARTITION,
                        webSecurity: true,
                        allowRunningInsecureContent: false
                    }
                }
            };
        }

        try {
            shell.openExternal(getSafeExternalUrl(url));
        } catch (error) {
            log.warn("Blocked unexpected popup URL", {
                url,
                message: error.message
            });
        }

        return { action: "deny" };
    });

    return mainWindow;
}

async function revealMainWindow() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.show();
    mainWindow.focus();
}

async function loadHostedApplication() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    await mainWindow.loadURL(APP_URL);
}

function setupSessionGuards() {
    const appSession = session.fromPartition(APP_SESSION_PARTITION);

    appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const requestingUrl = details?.requestingUrl || webContents?.getURL() || "";
        const isTrustedRequest = isTrustedRendererUrl(requestingUrl);
        const allowedPermissions = new Set([
            "clipboard-sanitized-write",
            "fullscreen",
            "notifications"
        ]);

        callback(isTrustedRequest && allowedPermissions.has(permission));
    });
}

function registerIpcHandlers() {
    ipcMain.handle("ask-ai", async (_event, message) => askAI(message));
    ipcMain.handle("generate-image", async (_event, prompt) => generateImage(prompt));
    ipcMain.handle("analyze-image", async (_event, payload) => analyzeImage(payload?.imageDataUrl, payload?.prompt));
    ipcMain.handle("open-external-url", async (_event, rawUrl) => {
        const safeUrl = getSafeExternalUrl(rawUrl);
        await shell.openExternal(safeUrl);
        return safeUrl;
    });
    ipcMain.handle("capture-app-screenshot", async () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return null;
        }

        const image = await mainWindow.webContents.capturePage();
        return image.toDataURL();
    });
    ipcMain.handle("desktop:get-app-info", async () => ({
        name: APP_NAME,
        version: app.getVersion(),
        platform: process.platform,
        packaged: app.isPackaged,
        appUrl: APP_URL
    }));
    ipcMain.handle("desktop:check-for-updates", async () => {
        if (!app.isPackaged) {
            const payload = {
                state: "skipped",
                message: "Auto-updates are disabled in development mode."
            };
            sendUpdateStatus(payload);
            return payload;
        }

        return checkForUpdates();
    });
}

function configureAutoUpdater() {
    autoUpdater.on("checking-for-update", () => {
        log.info("Checking for updates...");
        sendUpdateStatus({
            state: "checking",
            message: "Checking for updates..."
        });
    });

    autoUpdater.on("update-available", (info) => {
        log.info("Update available", info);
        showDesktopNotification(APP_NAME, `Update ${info.version} is available and downloading now.`);
        sendUpdateStatus({
            state: "available",
            message: `Downloading update ${info.version} in the background...`,
            version: info.version
        });
    });

    autoUpdater.on("update-not-available", (info) => {
        log.info("No updates available", info);
        sendUpdateStatus({
            state: "not-available",
            message: "You already have the latest desktop version.",
            version: info.version
        });
    });

    autoUpdater.on("download-progress", (progress) => {
        const percent = Number.isFinite(progress?.percent) ? Math.round(progress.percent) : 0;
        sendUpdateStatus({
            state: "downloading",
            message: `Downloading update... ${percent}%`,
            percent
        });
    });

    autoUpdater.on("update-downloaded", async (info) => {
        log.info("Update downloaded", info);
        showDesktopNotification(APP_NAME, `Update ${info.version} has been downloaded and is ready to install.`);
        sendUpdateStatus({
            state: "downloaded",
            message: `Update ${info.version} is ready to install.`,
            version: info.version
        });

        if (updatePromptVisible) {
            return;
        }

        updatePromptVisible = true;
        try {
            const response = await dialog.showMessageBox({
                type: "info",
                buttons: ["Restart Now", "Later"],
                defaultId: 0,
                cancelId: 1,
                noLink: true,
                title: `${APP_NAME} Update Ready`,
                message: `Version ${info.version} has been downloaded.`,
                detail: "Restart the app now to install the update. If you choose Later, it will install automatically the next time you quit."
            });

            if (response.response === 0) {
                autoUpdater.quitAndInstall();
            }
        } finally {
            updatePromptVisible = false;
        }
    });

    autoUpdater.on("error", (error) => {
        const message = error?.message || "Auto-update failed.";
        log.error("Auto-update error", error);
        sendUpdateStatus({
            state: "error",
            message
        });
    });
}

async function checkForUpdates() {
    if (!app.isPackaged) {
        return {
            state: "skipped",
            message: "Auto-updates are disabled in development mode."
        };
    }

    if (updateCheckPromise) {
        return updateCheckPromise;
    }

    updateCheckPromise = autoUpdater.checkForUpdates()
        .then((result) => ({
            state: "started",
            message: "Update check started.",
            version: result?.updateInfo?.version || null
        }))
        .catch((error) => {
            const message = error?.message || "Auto-update check failed.";
            log.error("Update check failed", error);
            sendUpdateStatus({
                state: "error",
                message
            });
            return {
                state: "error",
                message
            };
        })
        .finally(() => {
            updateCheckPromise = null;
        });

    return updateCheckPromise;
}

function scheduleAutoUpdates() {
    if (!app.isPackaged) {
        log.info("Skipping auto-updates while running unpackaged.");
        return;
    }

    checkForUpdates().catch((error) => {
        log.error("Initial update check failed", error);
    });

    setInterval(() => {
        checkForUpdates().catch((error) => {
            log.error("Scheduled update check failed", error);
        });
    }, UPDATE_CHECK_INTERVAL_MS);
}

async function launchApplication() {
    createSplashWindow();
    createMainWindow();

    const minSplashDelay = wait(SPLASH_MIN_DURATION_MS);
    const appLoad = loadHostedApplication();

    await Promise.allSettled([minSplashDelay, appLoad]);
    await revealMainWindow();
    scheduleAutoUpdates();
}

function focusExistingMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
}

app.setAppUserModelId(APP_ID);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        focusExistingMainWindow();
    });

    app.whenReady().then(async () => {
        log.info(`${APP_NAME} starting`, {
            version: app.getVersion(),
            appUrl: APP_URL,
            packaged: app.isPackaged
        });

        setupSessionGuards();
        registerIpcHandlers();
        configureAutoUpdater();

        await launchApplication();

        app.on("activate", async () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                await launchApplication();
                return;
            }

            focusExistingMainWindow();
        });
    });
}

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
