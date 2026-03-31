import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
    auth,
    ensureSchoolPersistence
} from "./firebase-context.js";

const LOGIN_PAGE = "/index.html";
const DOS_LOGIN_PAGE = "/school/dos-login.html";
const TEACHER_LOGIN_PAGE = "/school/teacher-login.html";

const refs = {
    status: null,
    teacherButton: null,
    dosButton: null
};

function setStatus(message, state = "info") {
    if (!refs.status) {
        return;
    }

    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function goTo(page) {
    const targetUrl = new URL(page, window.location.href).toString();
    if (window.location.href !== targetUrl) {
        window.location.href = targetUrl;
    }
}

function collectRefs() {
    refs.status = document.getElementById("school-access-status");
    refs.teacherButton = document.getElementById("school-open-teacher-login");
    refs.dosButton = document.getElementById("school-open-dos-login");
}

async function initializeSchoolAccessPage() {
    collectRefs();
    await ensureSchoolPersistence();

    refs.teacherButton?.addEventListener("click", () => {
        goTo(TEACHER_LOGIN_PAGE);
    });

    refs.dosButton?.addEventListener("click", () => {
        goTo(DOS_LOGIN_PAGE);
    });

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            setStatus("No JohnyBrowserHub session was found. Redirecting to the main login page...", "error");
            goTo(LOGIN_PAGE);
            return;
        }

        setStatus("Choose whether to continue as DOS or Teacher, then sign in with your school access details.", "info");
    });
}

window.addEventListener("DOMContentLoaded", () => {
    initializeSchoolAccessPage().catch((error) => {
        console.error("School access page failed:", error);
        setStatus("School access could not be loaded right now.", "error");
    });
});
