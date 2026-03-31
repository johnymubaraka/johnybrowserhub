const { contextBridge, ipcRenderer } = require("electron");

const APP_URL = process.env.JOHNY_BROWSERHUB_URL || "https://johnybrowserhub.web.app";
const TRUSTED_ORIGINS = new Set([
    new URL(APP_URL).origin,
    "https://johnybrowserhub.firebaseapp.com"
]);

function isTrustedOrigin() {
    try {
        return TRUSTED_ORIGINS.has(window.location.origin);
    } catch (error) {
        return false;
    }
}

function exposeTrustedApi() {
    const electronAI = Object.freeze({
        askAI(message) {
            return ipcRenderer.invoke("ask-ai", message);
        },
        generateImage(prompt) {
            return ipcRenderer.invoke("generate-image", prompt);
        },
        analyzeImage(payload) {
            return ipcRenderer.invoke("analyze-image", payload);
        },
        openExternalUrl(url) {
            return ipcRenderer.invoke("open-external-url", url);
        },
        captureAppScreenshot() {
            return ipcRenderer.invoke("capture-app-screenshot");
        }
    });

    const electronDesktop = Object.freeze({
        getAppInfo() {
            return ipcRenderer.invoke("desktop:get-app-info");
        },
        checkForUpdates() {
            return ipcRenderer.invoke("desktop:check-for-updates");
        },
        onUpdateStatus(callback) {
            if (typeof callback !== "function") {
                return () => {};
            }

            const listener = (_event, payload) => {
                callback(payload);
            };

            ipcRenderer.on("desktop:update-status", listener);
            return () => {
                ipcRenderer.removeListener("desktop:update-status", listener);
            };
        }
    });

    contextBridge.exposeInMainWorld("electronAI", electronAI);
    contextBridge.exposeInMainWorld("electronDesktop", electronDesktop);
}

if (isTrustedOrigin()) {
    exposeTrustedApi();
}
