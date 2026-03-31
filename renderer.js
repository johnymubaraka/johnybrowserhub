import { initializeJohnyBrowserHub } from "./workspace-app.js";

window.addEventListener("DOMContentLoaded", () => {
    initializeJohnyBrowserHub().catch((error) => {
        console.error("App initialization failed:", error);

        const status = document.getElementById("browser-status") || document.getElementById("downloads-status");
        if (status) {
            status.textContent = "App initialization failed. Please restart the app.";
            status.dataset.state = "error";
            return;
        }

        const authStatus = document.getElementById("auth-status");
        if (authStatus) {
            authStatus.textContent = "App initialization failed. Please restart the app.";
            authStatus.dataset.state = "error";
        }

        const authButton = document.getElementById("google-signin-button");
        if (authButton) {
            authButton.disabled = false;
        }
    });
});
