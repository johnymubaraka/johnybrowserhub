import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    getRedirectResult,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithRedirect,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    getDocs,
    getFirestore,
    limit,
    query,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const HOME_URL = "johnybrowserhub://desktop";
const HOME_TITLE = "JohnyBrowserHub Desktop";
const LOGIN_PAGE = "/index.html";
const BROWSER_PAGE = "/browser.html";
const DOWNLOADS_PAGE = "/downloads.html";
const SCHOOL_ACCESS_PAGE = "/school/auth.html";
const SCHOOL_DASHBOARD_PAGE = "/school/dashboard.html";
const SHARED_PARTITION = "persist:johnybrowserhub";
const CHAT_HISTORY_STORAGE_KEY = "johnybrowserhub-ai-chat-history";
const PROFILE_STORAGE_KEY = "johnybrowserhub-profile";
const MAX_CHAT_HISTORY = 24;
const DEFAULT_CHAT_GREETING = "Hi, I'm JohnyBrowserHub AI. Ask me about the page you're viewing, what to browse next, or anything else you need help with.";
const DEFAULT_PROFILE_AVATAR = "🤖";
const DEFAULT_SERVICE_LOADING_MESSAGE = "Connecting to JohnyBrowserHub services...";
const SERVICE_LOADING_STYLE_ID = "johnybrowserhub-service-loading-style";
const SERVICE_LOADING_OVERLAY_ID = "johnybrowserhub-service-loading-overlay";
const SERVICE_LOADING_NAV_STORAGE_KEY = "johnybrowserhub-service-loading-navigation";
const AUTH_SUCCESS_LOADING_DURATION_MS = 5000;
const PROFILE_EMOJIS = ["🤖", "😎", "😀", "🚀", "🦊", "🛡️", "🌍", "🔥", "💡", "🎯"];
const DESKTOP_APPS = [
    {
        name: "Chrome",
        subtitle: "Google browser",
        url: "https://www.google.com/chrome/",
        icon: "assets/chrome.svg",
        badge: "CH",
        accent: "#ffd54a",
        accentSoft: "rgba(255, 213, 74, 0.24)"
    },
    {
        name: "Firefox",
        subtitle: "Mozilla web",
        url: "https://www.mozilla.org/firefox/new/",
        icon: "assets/firefox.svg",
        badge: "FF",
        accent: "#ff8648",
        accentSoft: "rgba(255, 134, 72, 0.24)"
    },
    {
        name: "Safari",
        subtitle: "Apple browser",
        url: "https://www.apple.com/safari/",
        icon: "assets/safari.svg",
        badge: "SF",
        accent: "#6bd8ff",
        accentSoft: "rgba(107, 216, 255, 0.24)"
    },
    {
        name: "Vivaldi",
        subtitle: "Creative flow",
        url: "https://vivaldi.com/",
        icon: "assets/vivaldi.svg",
        badge: "V",
        accent: "#ff6870",
        accentSoft: "rgba(255, 104, 112, 0.24)"
    },
    {
        name: "Brave",
        subtitle: "Privacy mode",
        url: "https://brave.com/",
        icon: "assets/brave.svg",
        badge: "B",
        accent: "#ff874d",
        accentSoft: "rgba(255, 135, 77, 0.24)"
    },
    {
        name: "Edge",
        subtitle: "Microsoft web",
        url: "https://www.microsoft.com/edge",
        icon: "assets/edge.svg",
        badge: "E",
        accent: "#49d0ff",
        accentSoft: "rgba(73, 208, 255, 0.24)"
    },
    {
        name: "Opera",
        subtitle: "Built-in VPN",
        url: "https://www.opera.com/",
        icon: "assets/opera.svg",
        badge: "O",
        accent: "#ff4f62",
        accentSoft: "rgba(255, 79, 98, 0.24)"
    },
    {
        name: "DuckDuckGo",
        subtitle: "Search private",
        url: "https://duckduckgo.com/",
        icon: "assets/duckduckgo.svg",
        badge: "D",
        accent: "#ff9a42",
        accentSoft: "rgba(255, 154, 66, 0.24)"
    },
    {
        name: "Tor Browser",
        subtitle: "Private access",
        url: "https://www.torproject.org/download/",
        icon: "assets/tor-browser.svg",
        badge: "T",
        accent: "#b98dff",
        accentSoft: "rgba(185, 141, 255, 0.24)"
    },
    {
        name: "YouTube",
        subtitle: "Video hub",
        url: "https://www.youtube.com/",
        icon: "assets/youtube.svg",
        badge: "YT",
        accent: "#ff5b63",
        accentSoft: "rgba(255, 91, 99, 0.24)"
    },
    {
        name: "Gmail",
        subtitle: "Mail inbox",
        url: "https://mail.google.com/",
        icon: "assets/gmail.svg",
        badge: "GM",
        accent: "#ffd15a",
        accentSoft: "rgba(255, 209, 90, 0.24)"
    },
    {
        name: "GitHub",
        subtitle: "Code projects",
        url: "https://github.com/",
        icon: "assets/github.svg",
        badge: "GH",
        accent: "#90a8ff",
        accentSoft: "rgba(144, 168, 255, 0.24)"
    }
];
const DESKTOP_BOOKMARKS = [
    {
        name: "Google Search",
        subtitle: "Search the web",
        url: "https://www.google.com/",
        icon: "assets/google-search.svg",
        badge: "G",
        accent: "#63c8ff",
        accentSoft: "rgba(99, 200, 255, 0.24)"
    },
    {
        name: "Stack Overflow",
        subtitle: "Developer help",
        url: "https://stackoverflow.com/",
        icon: "assets/stack-overflow.svg",
        badge: "SO",
        accent: "#ff9d52",
        accentSoft: "rgba(255, 157, 82, 0.24)"
    },
    {
        name: "Wikipedia",
        subtitle: "Research faster",
        url: "https://www.wikipedia.org/",
        icon: "assets/wikipedia.svg",
        badge: "WK",
        accent: "#d0d8ff",
        accentSoft: "rgba(208, 216, 255, 0.24)"
    },
    {
        name: "Downloads",
        subtitle: "VPNs and browsers",
        action: "downloads",
        icon: "assets/downloads.svg",
        badge: "DL",
        accent: "#57dba8",
        accentSoft: "rgba(87, 219, 168, 0.24)"
    },
    {
        name: "Johny AI Assistant",
        subtitle: "Open chat bot",
        action: "chat",
        icon: "assets/johny-ai-assistant.svg",
        badge: "AI",
        accent: "#7aa8ff",
        accentSoft: "rgba(122, 168, 255, 0.24)"
    },
    {
        name: "Settings",
        subtitle: "Open menu",
        action: "settings",
        icon: "assets/settings.svg",
        badge: "ST",
        accent: "#e18cff",
        accentSoft: "rgba(225, 140, 255, 0.24)"
    }
];
const DESKTOP_DOCK_ITEMS = [
    {
        label: "Home",
        action: "home",
        icon: "assets/home.svg",
        badge: "H"
    },
    {
        label: "Bookmarks",
        action: "bookmarks",
        icon: "assets/bookmarks.svg",
        badge: "B"
    },
    {
        label: "Johny AI",
        action: "chat",
        icon: "assets/johny-ai-assistant.svg",
        badge: "AI"
    },
    {
        label: "Downloads",
        action: "downloads",
        icon: "assets/downloads.svg",
        badge: "D"
    },
    {
        label: "School Management",
        action: "school-system",
        icon: "assets/school-management.svg",
        badge: "SM",
        requireRole: "schoolAdmin"
    },
    {
        label: "Settings",
        action: "settings",
        icon: "assets/settings.svg",
        badge: "S"
    }
];

const firebaseConfig = {
    apiKey: "AIzaSyCeVhAobvObhafPvRb6-SD4NN8mNtL4rGw",
    authDomain: "johnybrowserhub.firebaseapp.com",
    databaseURL: "https://johnybrowserhub-default-rtdb.firebaseio.com",
    projectId: "johnybrowserhub",
    storageBucket: "johnybrowserhub.firebasestorage.app",
    messagingSenderId: "119679857218",
    appId: "1:119679857218:web:6704aeb6aab486087a33db",
    measurementId: "G-ZSZ04R06GE"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
    prompt: "select_account"
});
provider.addScope("email");
provider.addScope("profile");

const uiRefs = {
    authButton: null,
    authGoogleButtons: [],
    authStatus: null,
    authSignupPanel: null,
    authLoginPanel: null,
    authSignupEmailButton: null,
    authLoginEmailButton: null,
    authSignupForm: null,
    authSignupRoleCopy: null,
    authDosTabButton: null,
    authTeacherTabButton: null,
    authDosForm: null,
    authDosNameInput: null,
    authDosEmailInput: null,
    authDosPasswordInput: null,
    authDosSubmitButton: null,
    authTeacherForm: null,
    authTeacherNameInput: null,
    authTeacherEmailInput: null,
    authTeacherPasswordInput: null,
    authTeacherTitleSelect: null,
    authTeacherModuleNameInput: null,
    authTeacherModuleCategorySelect: null,
    authTeacherClassIdInput: null,
    authTeacherSubmitButton: null,
    authLoginForm: null,
    authLoginEmailInput: null,
    authLoginPasswordInput: null,
    authLoginSubmitButton: null,
    authForgotPasswordButton: null,
    authLoginLink: null,
    authSignupLink: null,
    sessionAvatar: null,
    sessionUser: null,
    sessionEmail: null,
    signOutButton: null,
    menuToggle: null,
    menuOverlay: null,
    sideMenu: null,
    menuCloseButton: null,
    menuHomePanel: null,
    menuProfilePanel: null,
    menuAboutPanel: null,
    menuProfileButton: null,
    menuAboutButton: null,
    menuProfileAvatar: null,
    menuProfileName: null,
    serviceAiChatButton: null,
    serviceDownloadsButton: null,
    serviceBrowserButton: null,
    serviceSchoolSystemButton: null,
    profileBackButton: null,
    aboutBackButton: null,
    profileNameInput: null,
    profileAvatarPreview: null,
    profileEmojiGrid: null,
    profileSaveButton: null,
    profileDeleteButton: null,
    profileSaveNote: null,
    tabsContainer: null,
    viewsContainer: null,
    addressForm: null,
    addressInput: null,
    addTabButton: null,
    browserStatus: null,
    chatToggle: null,
    chatPanel: null,
    chatMessages: null,
    chatForm: null,
    chatInput: null,
    chatSendButton: null,
    chatCloseButton: null,
    downloadsStatus: null,
    vpnDownloads: null,
    browserDownloads: null,
    schoolStatus: null,
    schoolName: null,
    schoolRole: null,
    schoolIdentifier: null,
    schoolAccessPanel: null,
    schoolStudentsPanel: null,
    schoolClassesPanel: null,
    schoolTeachersPanel: null,
    schoolModulesPanel: null,
    schoolStudentsCount: null,
    schoolClassesCount: null,
    schoolTeachersCount: null,
    schoolReportsCount: null,
    schoolReportsPanel: null,
    serviceLoadingOverlay: null,
    serviceLoadingMessage: null
};

const appState = {
    page: "",
    currentUser: null,
    currentUserModel: {
        uid: "",
        email: "",
        displayName: "",
        role: "user",
        schoolId: "",
        schoolName: ""
    },
    shellInitialized: false,
    browserInitialized: false,
    chatInitialized: false,
    downloadsInitialized: false,
    schoolDashboardInitialized: false,
    schoolDataStore: null,
    tabs: [],
    activeTabId: null,
    nextTabId: 1,
    chatMessages: [],
    chatOpen: false,
    chatPending: false,
    authRegistrationMode: "dos",
    menuOpen: false,
    menuPanel: "home",
    profile: {
        username: "",
        avatar: DEFAULT_PROFILE_AVATAR
    },
    profileDraft: {
        username: "",
        avatar: DEFAULT_PROFILE_AVATAR
    },
    serviceLoadingEntries: [],
    navigationLoadingToken: "",
    navigationLoadingState: null
};

function createDefaultUserModel(user = null) {
    return {
        uid: user?.uid || "",
        email: user?.email || "",
        displayName: getFallbackDisplayName(user),
        role: "user",
        schoolId: "",
        schoolName: ""
    };
}

function buildPageUrl(page, params = {}) {
    const url = new URL(page, window.location.href);

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            url.searchParams.delete(key);
            return;
        }

        url.searchParams.set(key, value);
    });

    return url.toString();
}

function delay(ms) {
    return Promise.resolve(ms);
}

function readNavigationLoadingState() {
    return null;
}

function clearNavigationLoadingState() {
    appState.navigationLoadingState = null;
}

function persistNavigationLoadingState(targetUrl, { loadingMessage = DEFAULT_SERVICE_LOADING_MESSAGE, minDurationMs = 0 } = {}) {
    void targetUrl;
    void loadingMessage;
    void minDurationMs;
}

function beginPendingNavigationLoading() {
    appState.navigationLoadingState = null;
    appState.navigationLoadingToken = "";
}

async function completePendingNavigationLoading({ skipDelay = false } = {}) {
    void skipDelay;
    appState.navigationLoadingToken = "";
    appState.navigationLoadingState = null;
    clearNavigationLoadingState();
}

function replaceTo(page, params = {}, options = {}) {
    const targetUrl = buildPageUrl(page, params);
    if (window.location.href !== targetUrl) {
        if (options.loadingMessage) {
            persistNavigationLoadingState(targetUrl, options);
        }
        window.location.replace(targetUrl);
    }
}

function goTo(page, params = {}, options = {}) {
    const targetUrl = buildPageUrl(page, params);
    if (window.location.href !== targetUrl) {
        if (options.loadingMessage) {
            persistNavigationLoadingState(targetUrl, options);
        }
        window.location.href = targetUrl;
    }
}

function isHomeUrl(url) {
    return `${url || ""}`.trim() === HOME_URL;
}

function escapeHtml(value) {
    return `${value || ""}`.replace(/[&<>"']/g, (character) => {
        switch (character) {
        case "&":
            return "&amp;";
        case "<":
            return "&lt;";
        case ">":
            return "&gt;";
        case "\"":
            return "&quot;";
        case "'":
            return "&#39;";
        default:
            return character;
        }
    });
}

function createDesktopTileMarkup(item, variant = "app") {
    const interactionAttribute = item.url
        ? `data-open-url="${escapeHtml(item.url)}"`
        : `data-desktop-action="${escapeHtml(item.action)}"`;
    const subtitleMarkup = item.subtitle
        ? `<span class="desktop-tile-subtitle">${escapeHtml(item.subtitle)}</span>`
        : "";
    const iconMarkup = item.icon
        ? `<span class="desktop-tile-icon desktop-tile-icon-image"><img src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)} icon"></span>`
        : `<span class="desktop-tile-icon" aria-hidden="true">${escapeHtml(item.badge)}</span>`;

    return `
        <button
            type="button"
            class="desktop-tile desktop-tile-${variant}"
            ${interactionAttribute}
            style="--desktop-accent:${item.accent}; --desktop-accent-soft:${item.accentSoft};"
        >
            ${iconMarkup}
            <span class="desktop-tile-name">${escapeHtml(item.name)}</span>
            ${subtitleMarkup}
        </button>
    `;
}

function createDesktopDockMarkup(item) {
    const iconMarkup = item.icon
        ? `<img src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.label)} icon">`
        : escapeHtml(item.badge);

    return `
        <button type="button" class="desktop-dock-button" data-desktop-action="${escapeHtml(item.action)}">
            <span class="desktop-dock-icon" aria-hidden="true">${iconMarkup}</span>
            <span class="desktop-dock-label">${escapeHtml(item.label)}</span>
        </button>
    `;
}

function getDesktopDockItems() {
    return DESKTOP_DOCK_ITEMS.filter((item) => !item.requireRole || appState.currentUserModel.role === item.requireRole);
}

function ensureServiceLoadingUi() {
    uiRefs.serviceLoadingOverlay = null;
    uiRefs.serviceLoadingMessage = null;
}

function updateServiceLoadingUi() {
    appState.serviceLoadingEntries = [];
}

function showServiceLoading(message = DEFAULT_SERVICE_LOADING_MESSAGE) {
    void message;
    return "";
}

function hideServiceLoading(token = "") {
    void token;
}

async function withServiceLoading(message, callback) {
    void message;
    return callback();
}

if (typeof window !== "undefined") {
    window.johnyBrowserHubServiceLoading = {
        show: showServiceLoading,
        hide: hideServiceLoading,
        withLoading: withServiceLoading
    };
}

function setServiceButtonActive(button, isActive) {
    if (!button) {
        return;
    }

    button.classList.toggle("is-active", isActive);

    if (isActive) {
        button.setAttribute("aria-current", "page");
        return;
    }

    button.removeAttribute("aria-current");
}

function syncServiceMenuState() {
    setServiceButtonActive(uiRefs.serviceBrowserButton, appState.page === "browser");
    setServiceButtonActive(uiRefs.serviceDownloadsButton, appState.page === "downloads");
    setServiceButtonActive(uiRefs.serviceSchoolSystemButton, appState.page === "school-dashboard");
}

function setAuthStatus(message, state = "info") {
    if (!uiRefs.authStatus) {
        return;
    }

    uiRefs.authStatus.textContent = message;
    uiRefs.authStatus.dataset.state = state;
}

function setAuthButtonPending(isPending) {
    const buttons = Array.isArray(uiRefs.authGoogleButtons) && uiRefs.authGoogleButtons.length > 0
        ? uiRefs.authGoogleButtons
        : [uiRefs.authButton].filter(Boolean);

    if (buttons.length === 0) {
        return;
    }

    buttons.forEach((button) => {
        button.disabled = isPending;
    });
}

function setSignupPending(isPending) {
    [
        uiRefs.authDosSubmitButton,
        uiRefs.authTeacherSubmitButton,
        uiRefs.authDosTabButton,
        uiRefs.authTeacherTabButton
    ].filter(Boolean).forEach((element) => {
        element.disabled = isPending;
    });
}

function setLoginPending(isPending) {
    if (uiRefs.authLoginSubmitButton) {
        uiRefs.authLoginSubmitButton.disabled = isPending;
    }

    if (uiRefs.authForgotPasswordButton) {
        uiRefs.authForgotPasswordButton.disabled = isPending;
    }
}

function isSchoolRegistrationExperience() {
    return document.body?.dataset.authDestination === "school";
}

function getAuthFlowConfig() {
    if (isSchoolRegistrationExperience()) {
        return {
            destinationPage: SCHOOL_ACCESS_PAGE,
            destinationLoadingMessage: "Opening School Management access...",
            idleStatusCopy: "Use Teacher Login, DOS Login, sign up, or sign in to continue into School Management.",
            googleSuccessCopy: "Google sign-in successful. Redirecting to School Management access...",
            existingSessionCopy: "You are already signed in. Redirecting to School Management access...",
            loginSuccessCopy: "Login successful. Redirecting to School Management access...",
            signupDestinationLabel: "School Management access"
        };
    }

    return {
        destinationPage: BROWSER_PAGE,
        destinationLoadingMessage: "Opening your browser workspace...",
        idleStatusCopy: "Sign in with Google to open your multi-tab browser.",
        googleSuccessCopy: "Google sign-in successful. Redirecting to your browser...",
        existingSessionCopy: "You are already signed in. Redirecting to your browser...",
        loginSuccessCopy: "Login successful. Redirecting to your browser...",
        signupDestinationLabel: "your workspace"
    };
}

function getAuthErrorMessage(error) {
    switch (error?.code) {
    case "auth/email-already-in-use":
        return "That email address is already in use. Try logging in instead.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
        return "The email address or password is incorrect.";
    case "auth/user-not-found":
        return "No account was found for that email address.";
    case "auth/invalid-email":
        return "Enter a valid email address.";
    case "auth/missing-password":
        return "Enter your password to continue.";
    case "auth/weak-password":
        return "Use a stronger password with at least 6 characters.";
    case "auth/too-many-requests":
        return "Too many attempts were made. Please wait a moment and try again.";
    case "auth/account-exists-with-different-credential":
        return "This Google account is linked to a different sign-in method in Firebase.";
    case "auth/cancelled-popup-request":
    case "auth/popup-blocked":
    case "auth/popup-closed-by-user":
        return "Google sign-in was interrupted before it completed.";
    case "auth/network-request-failed":
        return "A network error interrupted Google sign-in. Please try again.";
    case "auth/unauthorized-domain":
        return "This app origin is not allowed in Firebase Authentication. Make sure localhost is authorized.";
    default:
        return error?.message || "Google sign-in failed. Please try again.";
    }
}

async function loginWithGoogle() {
    setAuthButtonPending(true);
    setAuthStatus("Redirecting to Google sign-in...", "info");
    const loadingToken = showServiceLoading("Opening Google sign-in...");

    try {
        await signInWithRedirect(auth, provider);
    } catch (error) {
        hideServiceLoading(loadingToken);
        const message = getAuthErrorMessage(error);
        console.error("Google redirect sign-in failed:", error);
        setAuthStatus(message, "error");
        window.alert(message);
        setAuthButtonPending(false);
    }
}

function setActiveAuthPanel(panelName) {
    if (uiRefs.authSignupPanel) {
        uiRefs.authSignupPanel.classList.toggle("is-active", panelName === "signup");
    }

    if (uiRefs.authLoginPanel) {
        uiRefs.authLoginPanel.classList.toggle("is-active", panelName === "login");
    }
}

function scrollAuthPanelIntoView(element) {
    if (!element) {
        return;
    }

    requestAnimationFrame(() => {
        element.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest"
        });
    });
}

function openSignupForm({ focus = false } = {}) {
    setActiveAuthPanel("signup");

    if (uiRefs.authSignupPanel) {
        uiRefs.authSignupPanel.classList.add("is-signup-open");
    }

    if (uiRefs.authSignupEmailButton) {
        uiRefs.authSignupEmailButton.setAttribute("aria-expanded", "true");
    }

    if (uiRefs.authSignupForm) {
        uiRefs.authSignupForm.hidden = false;
    }

    setRegistrationMode(appState.authRegistrationMode);

    if (focus) {
        scrollAuthPanelIntoView(uiRefs.authSignupPanel);
        getActiveRegistrationFocusTarget()?.focus();
    }
}

function focusLoginForm({ focus = false } = {}) {
    setActiveAuthPanel("login");

    if (focus) {
        scrollAuthPanelIntoView(uiRefs.authLoginPanel);
        uiRefs.authLoginEmailInput?.focus();
    }
}

function normalizeEmail(value) {
    return `${value || ""}`.trim().toLowerCase();
}

function getActiveRegistrationFocusTarget() {
    return appState.authRegistrationMode === "teacher"
        ? uiRefs.authTeacherNameInput
        : uiRefs.authDosNameInput;
}

function setRegistrationMode(mode = "dos") {
    const nextMode = mode === "teacher" ? "teacher" : "dos";
    appState.authRegistrationMode = nextMode;

    if (uiRefs.authDosTabButton) {
        const isDos = nextMode === "dos";
        uiRefs.authDosTabButton.classList.toggle("is-active", isDos);
        uiRefs.authDosTabButton.setAttribute("aria-selected", String(isDos));
    }

    if (uiRefs.authTeacherTabButton) {
        const isTeacher = nextMode === "teacher";
        uiRefs.authTeacherTabButton.classList.toggle("is-active", isTeacher);
        uiRefs.authTeacherTabButton.setAttribute("aria-selected", String(isTeacher));
    }

    if (uiRefs.authDosForm) {
        uiRefs.authDosForm.hidden = nextMode !== "dos";
    }

    if (uiRefs.authTeacherForm) {
        uiRefs.authTeacherForm.hidden = nextMode !== "teacher";
    }

    if (uiRefs.authSignupRoleCopy) {
        uiRefs.authSignupRoleCopy.textContent = nextMode === "teacher"
            ? "Teacher registration saves to Firebase Auth and the teachers collection with module name, category, title, and class ID."
            : "DOS registration saves to Firebase Auth and the dos collection with role set to dos.";
    }
}

async function hashPasswordForStorage(password) {
    const encoded = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
}

async function checkCollectionEmailExists(collectionName, normalizedEmail) {
    const snapshot = await getDocs(query(collection(db, collectionName), where("email", "==", normalizedEmail), limit(1)));
    return !snapshot.empty;
}

async function ensureRegistrationEmailIsUnique(normalizedEmail) {
    const [dosEmailInUse, teacherEmailInUse] = await Promise.all([
        checkCollectionEmailExists("dos", normalizedEmail),
        checkCollectionEmailExists("teachers", normalizedEmail)
    ]);

    if (dosEmailInUse || teacherEmailInUse) {
        const error = new Error("That email address is already registered.");
        error.code = "auth/email-already-in-use";
        throw error;
    }
}

async function createRegisteredAccount({
    collectionName,
    displayName,
    email,
    password,
    statusCopy,
    buildProfile,
    loadingMessage = "Creating your account..."
}) {
    return withServiceLoading(loadingMessage, async () => {
        const authFlow = getAuthFlowConfig();
        const normalizedEmail = normalizeEmail(email);
        const hashedPassword = await hashPasswordForStorage(password);

        await ensureRegistrationEmailIsUnique(normalizedEmail);

        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

        try {
            if (displayName) {
                await updateProfile(credential.user, {
                    displayName
                });
            }

            await addDoc(collection(db, collectionName), {
                uid: credential.user.uid,
                email: normalizedEmail,
                password: hashedPassword,
                ...buildProfile(),
                createdAt: serverTimestamp()
            });

            await credential.user.getIdToken(true);
            setAuthStatus(statusCopy, "success");
            replaceTo(authFlow.destinationPage, {}, {
                loadingMessage: authFlow.destinationLoadingMessage,
                minDurationMs: AUTH_SUCCESS_LOADING_DURATION_MS
            });
        } catch (error) {
            try {
                await deleteUser(credential.user);
            } catch (deleteError) {
                console.warn("Account rollback after Firestore save failure did not complete:", deleteError);
            }
            throw error;
        }
    });
}

async function handleDosSignupSubmit(event) {
    event.preventDefault();
    const authFlow = getAuthFlowConfig();

    const name = sanitizeProfileName(uiRefs.authDosNameInput?.value);
    const email = normalizeEmail(uiRefs.authDosEmailInput?.value);
    const password = `${uiRefs.authDosPasswordInput?.value || ""}`;

    if (!name) {
        setAuthStatus("Enter the DOS name before registering.", "error");
        uiRefs.authDosNameInput?.focus();
        return;
    }

    if (!email) {
        setAuthStatus("Enter the DOS email address before registering.", "error");
        uiRefs.authDosEmailInput?.focus();
        return;
    }

    if (password.length < 6) {
        setAuthStatus("DOS password must be at least 6 characters long.", "error");
        uiRefs.authDosPasswordInput?.focus();
        return;
    }

    setActiveAuthPanel("signup");
    setRegistrationMode("dos");
    setSignupPending(true);
    setAuthStatus("Creating the DOS account...", "info");

    try {
        await createRegisteredAccount({
            collectionName: "dos",
            displayName: name,
            email,
            password,
            statusCopy: `DOS registration successful. Redirecting to ${authFlow.signupDestinationLabel}...`,
            loadingMessage: "Creating the DOS account...",
            buildProfile: () => ({
                name,
                role: "dos"
            })
        });
    } catch (error) {
        const message = getAuthErrorMessage(error);
        console.error("DOS registration failed:", error);
        setAuthStatus(message, "error");
        window.alert(message);
    } finally {
        setSignupPending(false);
    }
}

async function handleTeacherSignupSubmit(event) {
    event.preventDefault();
    const authFlow = getAuthFlowConfig();

    const name = sanitizeProfileName(uiRefs.authTeacherNameInput?.value);
    const email = normalizeEmail(uiRefs.authTeacherEmailInput?.value);
    const password = `${uiRefs.authTeacherPasswordInput?.value || ""}`;
    const title = `${uiRefs.authTeacherTitleSelect?.value || "normal"}`.trim() || "normal";
    const moduleName = `${uiRefs.authTeacherModuleNameInput?.value || ""}`.trim();
    const moduleCategory = `${uiRefs.authTeacherModuleCategorySelect?.value || "general"}`.trim() || "general";
    const classId = `${uiRefs.authTeacherClassIdInput?.value || ""}`.trim();

    if (!name) {
        setAuthStatus("Enter the teacher name before registering.", "error");
        uiRefs.authTeacherNameInput?.focus();
        return;
    }

    if (!email) {
        setAuthStatus("Enter the teacher email address before registering.", "error");
        uiRefs.authTeacherEmailInput?.focus();
        return;
    }

    if (password.length < 6) {
        setAuthStatus("Teacher password must be at least 6 characters long.", "error");
        uiRefs.authTeacherPasswordInput?.focus();
        return;
    }

    if (!moduleName) {
        setAuthStatus("Enter the teacher module name before registering.", "error");
        uiRefs.authTeacherModuleNameInput?.focus();
        return;
    }

    if (!classId) {
        setAuthStatus("Enter the teacher class ID before registering.", "error");
        uiRefs.authTeacherClassIdInput?.focus();
        return;
    }

    setActiveAuthPanel("signup");
    setRegistrationMode("teacher");
    setSignupPending(true);
    setAuthStatus("Creating the teacher account...", "info");

    try {
        await createRegisteredAccount({
            collectionName: "teachers",
            displayName: name,
            email,
            password,
            statusCopy: `Teacher registration successful. Redirecting to ${authFlow.signupDestinationLabel}...`,
            loadingMessage: "Creating the teacher account...",
            buildProfile: () => ({
                name,
                fullName: name,
                role: "teacher",
                title,
                moduleName,
                subject: moduleName,
                moduleCategory,
                classId
            })
        });
    } catch (error) {
        const message = getAuthErrorMessage(error);
        console.error("Teacher registration failed:", error);
        setAuthStatus(message, "error");
        window.alert(message);
    } finally {
        setSignupPending(false);
    }
}

async function handleEmailLoginSubmit(event) {
    event.preventDefault();
    const authFlow = getAuthFlowConfig();

    const email = `${uiRefs.authLoginEmailInput?.value || ""}`.trim();
    const password = `${uiRefs.authLoginPasswordInput?.value || ""}`;

    if (!email) {
        setAuthStatus("Enter your email address to log in.", "error");
        uiRefs.authLoginEmailInput?.focus();
        return;
    }

    if (!password) {
        setAuthStatus("Enter your password to log in.", "error");
        uiRefs.authLoginPasswordInput?.focus();
        return;
    }

    setActiveAuthPanel("login");
    setLoginPending(true);
    setAuthStatus("Signing you in...", "info");

    try {
        const credential = await withServiceLoading("Signing you in...", async () => {
            const nextCredential = await signInWithEmailAndPassword(auth, email, password);
            await nextCredential.user.getIdToken();
            return nextCredential;
        });
        setAuthStatus(authFlow.loginSuccessCopy, "success");
        replaceTo(authFlow.destinationPage, {}, {
            loadingMessage: authFlow.destinationLoadingMessage,
            minDurationMs: AUTH_SUCCESS_LOADING_DURATION_MS
        });
    } catch (error) {
        const message = getAuthErrorMessage(error);
        console.error("Email login failed:", error);
        setAuthStatus(message, "error");
        window.alert(message);
    } finally {
        setLoginPending(false);
    }
}

async function handleForgotPassword() {
    const email = `${uiRefs.authLoginEmailInput?.value || ""}`.trim();

    if (!email) {
        setAuthStatus("Enter your email address first, then choose Forgot Password.", "error");
        uiRefs.authLoginEmailInput?.focus();
        return;
    }

    setActiveAuthPanel("login");
    setLoginPending(true);
    setAuthStatus("Sending your password reset email...", "info");

    try {
        await withServiceLoading("Sending your password reset email...", () => sendPasswordResetEmail(auth, email));
        setAuthStatus("Password reset email sent. Check your inbox and spam folder.", "success");
    } catch (error) {
        const message = getAuthErrorMessage(error);
        console.error("Password reset failed:", error);
        setAuthStatus(message, "error");
        window.alert(message);
    } finally {
        setLoginPending(false);
    }
}

function getFallbackDisplayName(user) {
    return user?.displayName || user?.email?.split("@")[0] || "JohnyBrowserHub User";
}

function sanitizeProfileName(value) {
    return `${value || ""}`.replace(/\s+/g, " ").trim().slice(0, 32);
}

async function findAdminSchoolForUser(user) {
    const schoolsRef = collection(db, "schools");

    try {
        const byUid = await getDocs(query(schoolsRef, where("adminUserIds", "array-contains", user.uid), limit(1)));
        if (!byUid.empty) {
            return byUid.docs[0];
        }
    } catch (error) {
        console.warn("School lookup by uid failed:", error);
    }

    if (!user?.email) {
        return null;
    }

    try {
        const normalizedEmail = `${user.email}`.trim().toLowerCase();
        const byEmail = await getDocs(query(schoolsRef, where("adminEmails", "array-contains", normalizedEmail), limit(1)));
        if (!byEmail.empty) {
            return byEmail.docs[0];
        }
    } catch (error) {
        console.warn("School lookup by email failed:", error);
    }

    return null;
}

async function findProfileDocumentForUser(collectionName, user) {
    if (!user) {
        return null;
    }

    try {
        const byUid = await getDocs(query(collection(db, collectionName), where("uid", "==", user.uid), limit(1)));
        if (!byUid.empty) {
            return byUid.docs[0];
        }
    } catch (error) {
        console.warn(`${collectionName} lookup by uid failed:`, error);
    }

    if (!user.email) {
        return null;
    }

    try {
        const normalizedEmail = normalizeEmail(user.email);
        const byEmail = await getDocs(query(collection(db, collectionName), where("email", "==", normalizedEmail), limit(1)));
        if (!byEmail.empty) {
            return byEmail.docs[0];
        }
    } catch (error) {
        console.warn(`${collectionName} lookup by email failed:`, error);
    }

    return null;
}

async function loadUserModel(user) {
    const nextUserModel = createDefaultUserModel(user);

    if (!user) {
        appState.currentUserModel = nextUserModel;
        return nextUserModel;
    }

    try {
        const schoolDocument = await findAdminSchoolForUser(user);
        if (schoolDocument) {
            const schoolData = schoolDocument.data() || {};
            nextUserModel.role = "schoolAdmin";
            nextUserModel.schoolId = schoolDocument.id;
            nextUserModel.schoolName = `${schoolData.name || schoolData.schoolName || "School Management"}`;
        }
    } catch (error) {
        console.warn("User school context could not be resolved:", error);
    }

    if (nextUserModel.role === "user") {
        try {
            const dosDocument = await findProfileDocumentForUser("dos", user);
            if (dosDocument) {
                const dosData = dosDocument.data() || {};
                nextUserModel.role = "dos";
                nextUserModel.schoolId = `${dosData.schoolId || nextUserModel.schoolId || ""}`.trim();
                nextUserModel.schoolName = `${dosData.schoolName || nextUserModel.schoolName || ""}`.trim();
            }
        } catch (error) {
            console.warn("DOS profile lookup failed:", error);
        }
    }

    if (nextUserModel.role === "user") {
        try {
            const teacherDocument = await findProfileDocumentForUser("teachers", user);
            if (teacherDocument) {
                const teacherData = teacherDocument.data() || {};
                nextUserModel.role = "teacher";
                nextUserModel.schoolId = `${teacherData.schoolId || nextUserModel.schoolId || ""}`.trim();
                nextUserModel.schoolName = `${teacherData.schoolName || nextUserModel.schoolName || ""}`.trim();
            }
        } catch (error) {
            console.warn("Teacher profile lookup failed:", error);
        }
    }

    appState.currentUserModel = nextUserModel;
    return nextUserModel;
}

function loadProfileForUser(user) {
    let parsedProfile = null;

    try {
        parsedProfile = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
    } catch (error) {
        console.warn("Could not restore profile settings:", error);
    }

    appState.profile = {
        username: sanitizeProfileName(parsedProfile?.username) || getFallbackDisplayName(user),
        avatar: PROFILE_EMOJIS.includes(parsedProfile?.avatar) ? parsedProfile.avatar : DEFAULT_PROFILE_AVATAR
    };
    appState.profileDraft = { ...appState.profile };
}

function syncRoleGatedUi() {
    const canAccessSchoolSystem = Boolean(appState.currentUser);

    if (uiRefs.serviceSchoolSystemButton) {
        uiRefs.serviceSchoolSystemButton.hidden = !canAccessSchoolSystem;
    }

    syncServiceMenuState();
}

function persistProfile() {
    try {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(appState.profile));
    } catch (error) {
        console.warn("Could not save profile settings:", error);
    }
}

function setProfileSaveNote(message, state = "info") {
    if (!uiRefs.profileSaveNote) {
        return;
    }

    uiRefs.profileSaveNote.textContent = message;
    uiRefs.profileSaveNote.dataset.state = state;
}

function updateSessionCard() {
    if (uiRefs.sessionAvatar) {
        uiRefs.sessionAvatar.textContent = appState.profile.avatar;
    }

    if (uiRefs.sessionUser) {
        uiRefs.sessionUser.textContent = appState.profile.username;
    }

    if (uiRefs.sessionEmail) {
        uiRefs.sessionEmail.textContent = appState.currentUser?.email || "Signed in";
    }

    if (uiRefs.menuProfileAvatar) {
        uiRefs.menuProfileAvatar.textContent = appState.profile.avatar;
    }

    if (uiRefs.menuProfileName) {
        uiRefs.menuProfileName.textContent = appState.profile.username;
    }
}

function updateProfileDraftUi() {
    if (uiRefs.profileAvatarPreview) {
        uiRefs.profileAvatarPreview.textContent = appState.profileDraft.avatar;
    }

    if (uiRefs.profileNameInput) {
        uiRefs.profileNameInput.value = appState.profileDraft.username;
    }

    if (uiRefs.profileEmojiGrid) {
        uiRefs.profileEmojiGrid.querySelectorAll(".emoji-option").forEach((button) => {
            const isSelected = button.dataset.emoji === appState.profileDraft.avatar;
            button.classList.toggle("is-selected", isSelected);
            button.setAttribute("aria-pressed", String(isSelected));
        });
    }
}

function renderEmojiPicker() {
    if (!uiRefs.profileEmojiGrid || uiRefs.profileEmojiGrid.childElementCount > 0) {
        updateProfileDraftUi();
        return;
    }

    const fragment = document.createDocumentFragment();

    PROFILE_EMOJIS.forEach((emoji) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "emoji-option";
        button.textContent = emoji;
        button.dataset.emoji = emoji;
        button.setAttribute("aria-label", `Choose ${emoji} as profile photo`);
        button.addEventListener("click", () => {
            appState.profileDraft.avatar = emoji;
            setProfileSaveNote("Your profile stays saved on this device.", "info");
            updateProfileDraftUi();
        });
        fragment.appendChild(button);
    });

    uiRefs.profileEmojiGrid.appendChild(fragment);
    updateProfileDraftUi();
}

function showMenuPanel(panelName) {
    appState.menuPanel = panelName;

    if (uiRefs.menuHomePanel) {
        uiRefs.menuHomePanel.classList.toggle("hidden", panelName !== "home");
    }

    if (uiRefs.menuProfilePanel) {
        uiRefs.menuProfilePanel.classList.toggle("hidden", panelName !== "profile");
    }

    if (uiRefs.menuAboutPanel) {
        uiRefs.menuAboutPanel.classList.toggle("hidden", panelName !== "about");
    }

    if (panelName === "profile") {
        appState.profileDraft = { ...appState.profile };
        renderEmojiPicker();
        setProfileSaveNote("Your profile stays saved on this device.", "info");
    }
}

function setMenuOpen(isOpen) {
    appState.menuOpen = isOpen;

    if (uiRefs.menuOverlay) {
        uiRefs.menuOverlay.classList.toggle("hidden", !isOpen);
    }

    if (uiRefs.sideMenu) {
        uiRefs.sideMenu.classList.toggle("hidden", !isOpen);
        uiRefs.sideMenu.setAttribute("aria-hidden", String(!isOpen));
    }

    if (uiRefs.menuToggle) {
        uiRefs.menuToggle.setAttribute("aria-expanded", String(isOpen));
    }

    if (!isOpen) {
        showMenuPanel("home");
    }
}

function setBrowserStatus(message, state = "info") {
    if (!uiRefs.browserStatus) {
        return;
    }

    uiRefs.browserStatus.textContent = message;
    uiRefs.browserStatus.dataset.state = state;
}

function setDownloadsStatus(message, state = "info") {
    if (!uiRefs.downloadsStatus) {
        return;
    }

    uiRefs.downloadsStatus.textContent = message;
    uiRefs.downloadsStatus.dataset.state = state;
}

function setSchoolStatus(message, state = "info") {
    if (!uiRefs.schoolStatus) {
        return;
    }

    uiRefs.schoolStatus.textContent = message;
    uiRefs.schoolStatus.dataset.state = state;
}

function setCurrentPageStatus(message, state = "info") {
    if (appState.page === "school-dashboard") {
        setSchoolStatus(message, state);
        return;
    }

    if (appState.page === "downloads") {
        setDownloadsStatus(message, state);
        return;
    }

    setBrowserStatus(message, state);
}

async function openExternalUrl(url) {
    if (!url) {
        return;
    }

    if (window.electronAI?.openExternalUrl) {
        await window.electronAI.openExternalUrl(url);
        return;
    }

    window.open(url, "_blank", "noopener");
}

async function handleSignOut() {
    try {
        await withServiceLoading("Signing you out...", () => signOut(auth));
        replaceTo(LOGIN_PAGE);
    } catch (error) {
        console.error("Sign out failed:", error);
        const message = "Sign out failed. Please try again.";
        setCurrentPageStatus(message, "error");
        window.alert(message);
    }
}

function setProfileDeleteButtonPending(isPending) {
    if (!uiRefs.profileDeleteButton) {
        return;
    }

    uiRefs.profileDeleteButton.disabled = isPending;
    uiRefs.profileDeleteButton.textContent = isPending ? "Deleting..." : "Delete account";
}

async function deleteStoredAccountDocuments(user) {
    const [dosResult, teacherResult] = await Promise.allSettled([
        findProfileDocumentForUser("dos", user),
        findProfileDocumentForUser("teachers", user)
    ]);

    const documentsToDelete = [dosResult, teacherResult]
        .filter((result) => result.status === "fulfilled" && result.value)
        .map((result) => result.value);

    const deletedPaths = new Set();

    await Promise.all(documentsToDelete.map(async (documentSnapshot) => {
        const documentPath = documentSnapshot.ref.path;

        if (deletedPaths.has(documentPath)) {
            return;
        }

        deletedPaths.add(documentPath);
        await deleteDoc(documentSnapshot.ref);
    }));
}

async function handleDeleteAccount() {
    const user = auth.currentUser || appState.currentUser;

    if (!user) {
        const message = "No signed-in account was found to delete.";
        setProfileSaveNote(message, "error");
        setCurrentPageStatus(message, "error");
        window.alert(message);
        return;
    }

    const confirmed = window.confirm("Delete this account permanently? This removes your sign-in and linked profile records and cannot be undone.");

    if (!confirmed) {
        return;
    }

    setProfileDeleteButtonPending(true);
    setProfileSaveNote("Deleting your account permanently...", "info");
    setCurrentPageStatus("Deleting your account permanently...", "info");

    try {
        const currentUser = auth.currentUser || user;

        await withServiceLoading("Deleting your account...", async () => {
            await deleteUser(currentUser);
            await deleteStoredAccountDocuments(currentUser);
        });

        window.localStorage.removeItem(PROFILE_STORAGE_KEY);
        window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
        appState.currentUser = null;
        appState.currentUserModel = createDefaultUserModel();
        appState.profile = {
            username: "",
            avatar: DEFAULT_PROFILE_AVATAR
        };
        appState.profileDraft = {
            username: "",
            avatar: DEFAULT_PROFILE_AVATAR
        };
        replaceTo(LOGIN_PAGE);
    } catch (error) {
        console.error("Account deletion failed:", error);
        const message = error?.code === "auth/requires-recent-login"
            ? "For security, please sign in again and then retry deleting your account."
            : "Account deletion failed. Please try again.";
        setProfileSaveNote(message, "error");
        setCurrentPageStatus(message, "error");
        window.alert(message);
    } finally {
        setProfileDeleteButtonPending(false);
    }
}

function handleProfileNameInput() {
    if (!uiRefs.profileNameInput) {
        return;
    }

    appState.profileDraft.username = sanitizeProfileName(uiRefs.profileNameInput.value);
    setProfileSaveNote("Save your changes to update the app profile.", "info");
}

function handleSaveProfile() {
    const nextName = sanitizeProfileName(uiRefs.profileNameInput?.value) || getFallbackDisplayName(appState.currentUser);

    appState.profile = {
        username: nextName,
        avatar: appState.profileDraft.avatar
    };
    appState.profileDraft = { ...appState.profile };

    persistProfile();
    updateSessionCard();
    updateProfileDraftUi();
    setProfileSaveNote("Profile saved successfully.", "success");
    setCurrentPageStatus("Profile updated successfully.", "success");
}

function handleServiceAiChat() {
    setMenuOpen(false);

    if (appState.page === "browser") {
        setChatOpen(true);
        setBrowserStatus("AI assistant opened.", "success");
        return;
    }

    goTo(BROWSER_PAGE, { open: "chat" }, {
        loadingMessage: "Opening AI Chat...",
        minDurationMs: 0
    });
}

function handleServiceDownloads() {
    setMenuOpen(false);

    if (appState.page === "downloads") {
        setDownloadsStatus("You are already on the downloads page.", "success");
        return;
    }

    goTo(DOWNLOADS_PAGE, {}, {
        loadingMessage: "Opening download services...",
        minDurationMs: 0
    });
}

function handleServiceBrowser() {
    setMenuOpen(false);

    if (appState.page === "browser") {
        setBrowserStatus("You are already in the multi-tab browser.", "success");
        return;
    }

    goTo(BROWSER_PAGE, {}, {
        loadingMessage: "Opening browser workspace...",
        minDurationMs: 0
    });
}

function handleServiceSchoolSystem() {
    setMenuOpen(false);

    goTo(SCHOOL_ACCESS_PAGE, {}, {
        loadingMessage: "Opening School Management access...",
        minDurationMs: 0
    });
}

function renderSchoolAccessPlaceholder({ title, description, tone = "info" }) {
    [
        uiRefs.schoolAccessPanel,
        uiRefs.schoolStudentsPanel,
        uiRefs.schoolClassesPanel,
        uiRefs.schoolTeachersPanel,
        uiRefs.schoolModulesPanel
    ].forEach((panel) => {
        if (!panel) {
            return;
        }

        panel.hidden = true;
        panel.innerHTML = "";
    });

    if (!uiRefs.schoolReportsPanel) {
        return;
    }

    uiRefs.schoolReportsPanel.hidden = false;
    uiRefs.schoolReportsPanel.innerHTML = `
        <article class="school-access-placeholder surface-block" data-state="${escapeAttribute(tone)}">
            <p class="menu-section-kicker">Services</p>
            <h3 class="school-panel-title">${escapeHtml(title)}</h3>
            <p class="school-panel-copy">${escapeHtml(description)}</p>
            <div class="school-access-meta">
                <span class="school-access-chip">Role: ${escapeHtml(appState.currentUserModel.role || "user")}</span>
                <span class="school-access-chip">School: ${escapeHtml(appState.currentUserModel.schoolName || "Not linked yet")}</span>
                <span class="school-access-chip">Email: ${escapeHtml(appState.currentUser?.email || "Signed in")}</span>
            </div>
        </article>
    `;
}

function showFullSchoolDashboardPanels() {
    [
        uiRefs.schoolAccessPanel,
        uiRefs.schoolStudentsPanel,
        uiRefs.schoolClassesPanel,
        uiRefs.schoolTeachersPanel,
        uiRefs.schoolModulesPanel,
        uiRefs.schoolReportsPanel
    ].forEach((panel) => {
        if (!panel) {
            return;
        }

        panel.hidden = false;
    });
}

function initializeShellUi() {
    if (appState.shellInitialized) {
        updateSessionCard();
        syncRoleGatedUi();
        return;
    }

    appState.shellInitialized = true;
    updateSessionCard();
    syncRoleGatedUi();
    renderEmojiPicker();
    showMenuPanel("home");
    setMenuOpen(false);

    uiRefs.menuToggle?.addEventListener("click", () => {
        setMenuOpen(!appState.menuOpen);
    });

    uiRefs.menuOverlay?.addEventListener("click", () => {
        setMenuOpen(false);
    });

    uiRefs.menuCloseButton?.addEventListener("click", () => {
        setMenuOpen(false);
    });

    uiRefs.menuProfileButton?.addEventListener("click", () => {
        showMenuPanel("profile");
    });

    uiRefs.menuAboutButton?.addEventListener("click", () => {
        showMenuPanel("about");
    });

    uiRefs.profileBackButton?.addEventListener("click", () => {
        showMenuPanel("home");
    });

    uiRefs.aboutBackButton?.addEventListener("click", () => {
        showMenuPanel("home");
    });

    uiRefs.profileNameInput?.addEventListener("input", handleProfileNameInput);
    uiRefs.profileSaveButton?.addEventListener("click", handleSaveProfile);
    uiRefs.profileDeleteButton?.addEventListener("click", handleDeleteAccount);
    uiRefs.signOutButton?.addEventListener("click", handleSignOut);
    uiRefs.serviceAiChatButton?.addEventListener("click", handleServiceAiChat);
    uiRefs.serviceDownloadsButton?.addEventListener("click", handleServiceDownloads);
    uiRefs.serviceBrowserButton?.addEventListener("click", handleServiceBrowser);
    uiRefs.serviceSchoolSystemButton?.addEventListener("click", handleServiceSchoolSystem);

    document.addEventListener("keydown", (event) => {
        const isRefreshShortcut = event.ctrlKey && !event.altKey && !event.shiftKey && `${event.key || ""}`.toLowerCase() === "r";

        if (isRefreshShortcut) {
            event.preventDefault();

            if (appState.page !== "browser") {
                window.location.reload();
                return;
            }

            const activeTab = getActiveTab();

            if (!activeTab) {
                window.location.reload();
                return;
            }

            if (activeTab.kind === "desktop" || isHomeUrl(activeTab.url)) {
                activeTab.url = HOME_URL;
                activeTab.title = HOME_TITLE;
                replaceTabBrowserElement(activeTab, HOME_URL);
                renderTabs();
                updateBrowserTitle();
                setBrowserStatus("JohnyBrowserHub desktop refreshed.", "success");
                return;
            }

            if (activeTab.browserElement && typeof activeTab.browserElement.reload === "function") {
                activeTab.browserElement.reload();
            } else if (activeTab.browserElement) {
                activeTab.browserElement.src = activeTab.url;
            } else {
                openUrlInTab(activeTab.id, activeTab.url);
            }

            setBrowserStatus(`Refreshing ${activeTab.title || activeTab.url}...`, "info");
            return;
        }

        if (event.key === "Escape" && appState.menuOpen) {
            setMenuOpen(false);
        }
    });
}

function loadChatHistory() {
    try {
        const rawValue = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
        if (!rawValue) {
            appState.chatMessages = [];
            return;
        }

        const parsed = JSON.parse(rawValue);
        appState.chatMessages = Array.isArray(parsed)
            ? parsed
                .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.text === "string")
                .slice(-MAX_CHAT_HISTORY)
            : [];
    } catch (error) {
        console.warn("Could not restore AI chat history:", error);
        appState.chatMessages = [];
    }
}

function persistChatHistory() {
    try {
        const safeHistory = appState.chatMessages
            .filter((item) => !item.pending)
            .slice(-MAX_CHAT_HISTORY);

        window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(safeHistory));
    } catch (error) {
        console.warn("Could not persist AI chat history:", error);
    }
}

function ensureChatHistorySeeded() {
    if (appState.chatMessages.length > 0) {
        return;
    }

    appState.chatMessages = [{
        role: "assistant",
        text: DEFAULT_CHAT_GREETING
    }];
    persistChatHistory();
}

function createChatMessageElement(message) {
    const element = document.createElement("article");
    element.className = `ai-chat-message ${message.role}${message.pending ? " pending" : ""}`;
    element.textContent = message.text;
    return element;
}

function scrollChatToBottom() {
    if (!uiRefs.chatMessages) {
        return;
    }

    uiRefs.chatMessages.scrollTop = uiRefs.chatMessages.scrollHeight;
}

function renderChatMessages() {
    if (!uiRefs.chatMessages) {
        return;
    }

    uiRefs.chatMessages.replaceChildren();

    const fragment = document.createDocumentFragment();
    appState.chatMessages.forEach((message) => {
        fragment.appendChild(createChatMessageElement(message));
    });

    uiRefs.chatMessages.appendChild(fragment);
    requestAnimationFrame(scrollChatToBottom);
}

function setChatPending(isPending) {
    appState.chatPending = isPending;

    if (uiRefs.chatInput) {
        uiRefs.chatInput.disabled = isPending;
    }

    if (uiRefs.chatSendButton) {
        uiRefs.chatSendButton.disabled = isPending;
    }
}

function setChatOpen(isOpen) {
    appState.chatOpen = isOpen;

    if (!uiRefs.chatPanel || !uiRefs.chatToggle) {
        return;
    }

    uiRefs.chatPanel.classList.toggle("hidden", !isOpen);
    uiRefs.chatPanel.setAttribute("aria-hidden", String(!isOpen));
    uiRefs.chatToggle.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
        requestAnimationFrame(() => {
            scrollChatToBottom();
            uiRefs.chatInput?.focus();
        });
    }
}

function getActiveTab() {
    return appState.tabs.find((tab) => tab.id === appState.activeTabId) || null;
}

function buildAiPrompt(message) {
    const activeTab = getActiveTab();

    if (!activeTab) {
        return message;
    }

    return [
        "You are helping the user inside JohnyBrowserHub.",
        `The current active tab title is: ${activeTab.title}.`,
        `The current active tab URL is: ${activeTab.url}.`,
        "",
        `User message: ${message}`
    ].join("\n");
}

async function requestAiChatReply(message) {
    const prompt = buildAiPrompt(message);

    if (window.electronAI?.askAI) {
        const answer = await window.electronAI.askAI(prompt);
        return `${answer || ""}`.trim() || "I couldn't generate a reply just now.";
    }

    const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: prompt })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "AI chat request failed");
    }

    return `${payload?.answer || ""}`.trim() || "I couldn't generate a reply just now.";
}

async function handleChatSubmit(event) {
    event.preventDefault();

    if (!uiRefs.chatInput || appState.chatPending) {
        return;
    }

    const message = uiRefs.chatInput.value.trim();
    if (!message) {
        uiRefs.chatInput.focus();
        return;
    }

    uiRefs.chatInput.value = "";
    appState.chatMessages.push({ role: "user", text: message });
    const pendingIndex = appState.chatMessages.push({
        role: "assistant",
        text: "Thinking...",
        pending: true
    }) - 1;

    renderChatMessages();
    persistChatHistory();
    setChatPending(true);

    try {
        const answer = await withServiceLoading("Johny AI is preparing your reply...", () => requestAiChatReply(message));
        appState.chatMessages[pendingIndex] = {
            role: "assistant",
            text: answer
        };
    } catch (error) {
        console.error("AI chat request failed:", error);
        appState.chatMessages[pendingIndex] = {
            role: "assistant",
            text: "I ran into a problem replying just now. Please try again in a moment."
        };
    } finally {
        renderChatMessages();
        persistChatHistory();
        setChatPending(false);
        uiRefs.chatInput?.focus();
    }
}

function handleChatInputKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        uiRefs.chatForm?.requestSubmit();
    }
}

function initializeChatUi() {
    if (appState.chatInitialized || !uiRefs.chatToggle || !uiRefs.chatPanel) {
        return;
    }

    appState.chatInitialized = true;
    loadChatHistory();
    ensureChatHistorySeeded();
    renderChatMessages();

    uiRefs.chatToggle.addEventListener("click", () => {
        setChatOpen(!appState.chatOpen);
    });

    uiRefs.chatCloseButton?.addEventListener("click", () => {
        setChatOpen(false);
    });

    uiRefs.chatForm?.addEventListener("submit", handleChatSubmit);
    uiRefs.chatInput?.addEventListener("keydown", handleChatInputKeydown);

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("open") === "chat") {
        setChatOpen(true);
        searchParams.delete("open");
        const url = new URL(window.location.href);
        url.search = searchParams.toString();
        window.history.replaceState({}, "", url);
    }
}

function createDesktopElement(tab) {
    const desktopElement = document.createElement("section");
    desktopElement.className = "browser-view browser-desktop";
    desktopElement.dataset.tabId = tab.id;
    desktopElement.innerHTML = `
        <div class="desktop-shell">
            <aside class="desktop-visual-pane">
                <div class="desktop-brand-pill">
                    <span class="desktop-brand-orb">AI</span>
                    <span class="desktop-brand-name">JohnyBrowserHub</span>
                </div>
                <div class="desktop-visual-copy">
                    <p class="desktop-kicker">Johny Browser Hub</p>
                    <h2 class="desktop-hero-title">Smart browser desktop</h2>
                    <p class="desktop-hero-text">Launch browsers, search the web, open downloads, and reach your AI assistant from one cosmic workspace.</p>
                </div>
                <div class="desktop-profile-card">
                    <div class="desktop-profile-avatar" aria-hidden="true">${escapeHtml(appState.profile.avatar)}</div>
                    <div>
                        <p class="desktop-profile-kicker">Signed in as</p>
                        <p class="desktop-profile-name">${escapeHtml(appState.profile.username)}</p>
                    </div>
                </div>
            </aside>

            <div class="desktop-main-pane">
                <form class="desktop-search-bar" aria-label="Desktop search">
                    <button type="button" class="desktop-search-button desktop-search-button-muted" data-desktop-action="new-tab" aria-label="Open a new desktop tab">+</button>
                    <button type="button" class="desktop-search-button desktop-search-button-muted" data-desktop-action="home" aria-label="Go to home">H</button>
                    <label class="desktop-search-field">
                        <span class="desktop-search-icon" aria-hidden="true">O</span>
                        <input class="desktop-search-input" type="text" placeholder="Search or enter website name" autocomplete="off" spellcheck="false">
                    </label>
                    <button type="button" class="desktop-search-button desktop-search-button-muted" data-desktop-action="refresh" aria-label="Refresh desktop">R</button>
                    <button type="submit" class="desktop-search-button desktop-search-button-accent" aria-label="Search">GO</button>
                </form>

                <section class="desktop-section">
                    <div class="desktop-section-head">
                        <p class="desktop-kicker">Applications</p>
                        <h3 class="desktop-section-title">Browse Your Apps</h3>
                        <p class="desktop-section-copy">A JohnyBrowserHub home desktop inspired by your reference image, rebuilt as a working launch surface inside the browser.</p>
                    </div>
                    <div class="desktop-app-grid">
                        ${DESKTOP_APPS.map((item) => createDesktopTileMarkup(item, "app")).join("")}
                    </div>
                </section>

                <section class="desktop-section desktop-bookmarks">
                    <div class="desktop-section-head">
                        <p class="desktop-kicker">Shortcuts</p>
                        <h3 class="desktop-section-title">Quick Access</h3>
                        <p class="desktop-section-copy">Jump into bookmarks, downloads, settings, and core browser destinations from this home tab.</p>
                    </div>
                    <div class="desktop-bookmark-grid">
                        ${DESKTOP_BOOKMARKS.map((item) => createDesktopTileMarkup(item, "bookmark")).join("")}
                    </div>
                </section>

                <nav class="desktop-dock" aria-label="Desktop dock">
                    ${getDesktopDockItems().map((item) => createDesktopDockMarkup(item)).join("")}
                </nav>
            </div>
        </div>
    `;

    const searchForm = desktopElement.querySelector(".desktop-search-bar");
    const searchInput = desktopElement.querySelector(".desktop-search-input");

    searchForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        openUrlInTab(tab.id, searchInput?.value || "");
    });

    desktopElement.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-open-url], [data-desktop-action]");
        if (!trigger) {
            return;
        }

        const { openUrl, desktopAction } = trigger.dataset;

        if (openUrl) {
            openUrlInTab(tab.id, openUrl);
            return;
        }

        switch (desktopAction) {
        case "home":
        case "refresh":
            desktopElement.scrollTo({
                top: 0,
                behavior: "smooth"
            });
            setBrowserStatus("JohnyBrowserHub desktop ready.", "success");
            break;
        case "bookmarks":
            desktopElement.querySelector(".desktop-bookmarks")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            setBrowserStatus("Quick access shortcuts are ready.", "info");
            break;
        case "chat":
            setChatOpen(true);
            setBrowserStatus("AI assistant opened.", "success");
            break;
        case "downloads":
            handleServiceDownloads();
            break;
        case "school-system":
            handleServiceSchoolSystem();
            break;
        case "settings":
            showMenuPanel("home");
            setMenuOpen(true);
            setBrowserStatus("Menu opened.", "info");
            break;
        case "new-tab":
            addTab(HOME_URL);
            break;
        default:
            break;
        }
    });

    return desktopElement;
}

function normalizeUrl(rawValue) {
    const value = `${rawValue || ""}`.trim();

    if (!value) {
        return HOME_URL;
    }

    if (isHomeUrl(value) || value.toLowerCase() === "desktop" || value.toLowerCase() === "home") {
        return HOME_URL;
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (/^[\w-]+\.[a-z]{2,}/i.test(value)) {
        return `https://${value}`;
    }

    return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

function getFallbackTitle(url) {
    if (isHomeUrl(url)) {
        return HOME_TITLE;
    }

    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname.replace(/^www\./, "") || "New Tab";
    } catch {
        return "New Tab";
    }
}

function getTabIndexById(tabId) {
    return appState.tabs.findIndex((tab) => tab.id === tabId);
}

function updateBrowserTitle() {
    const activeTab = getActiveTab();
    document.title = activeTab ? `${activeTab.title} - JohnyBrowserHub` : "JohnyBrowserHub Browser";

    if (uiRefs.addressInput && activeTab) {
        uiRefs.addressInput.value = isHomeUrl(activeTab.url) ? "" : activeTab.url;
        uiRefs.addressInput.placeholder = isHomeUrl(activeTab.url)
            ? "Search or enter website name"
            : "Enter a website or search term";
    }
}

function createBrowserElement(url) {
    const isElectron = navigator.userAgent.includes("Electron");

    if (isElectron) {
        const webview = document.createElement("webview");
        webview.className = "browser-view";
        webview.src = url;
        webview.setAttribute("partition", SHARED_PARTITION);
        webview.setAttribute("allowpopups", "");
        return webview;
    }

    const iframe = document.createElement("iframe");
    iframe.className = "browser-view";
    iframe.src = url;
    iframe.loading = "eager";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    return iframe;
}

function replaceTabBrowserElement(tab, nextUrl) {
    const previousElement = tab.browserElement;
    let nextElement = null;

    if (isHomeUrl(nextUrl)) {
        tab.kind = "desktop";
        nextElement = createDesktopElement(tab);
    } else {
        tab.kind = "web";
        nextElement = createBrowserElement(nextUrl);
    }

    tab.browserElement = nextElement;

    if (previousElement) {
        previousElement.replaceWith(nextElement);
    } else {
        uiRefs.viewsContainer?.appendChild(nextElement);
    }

    if (tab.kind === "web") {
        wireBrowserElementEvents(tab);
    }

    nextElement.classList.toggle("active", tab.id === appState.activeTabId);
}

function updateTabTitleById(tabId, title) {
    const tabIndex = getTabIndexById(tabId);
    if (tabIndex === -1) {
        return;
    }

    appState.tabs[tabIndex].title = `${title || ""}`.trim() || "New Tab";
    renderTabs();
}

function updateTabUrlById(tabId, url) {
    const tabIndex = getTabIndexById(tabId);
    if (tabIndex === -1) {
        return;
    }

    appState.tabs[tabIndex].url = url;

    if (appState.activeTabId === tabId) {
        updateBrowserTitle();
    }
}

function wireBrowserElementEvents(tab) {
    const tagName = tab.browserElement.tagName.toLowerCase();

    if (tagName === "webview") {
        tab.browserElement.addEventListener("page-title-updated", (event) => {
            updateTabTitleById(tab.id, event.title);
        });

        tab.browserElement.addEventListener("did-stop-loading", () => {
            const resolvedUrl = tab.browserElement.getURL() || tab.url;
            const resolvedTitle = tab.browserElement.getTitle() || getFallbackTitle(resolvedUrl);

            updateTabUrlById(tab.id, resolvedUrl);
            updateTabTitleById(tab.id, resolvedTitle);
            setBrowserStatus(`Loaded ${resolvedTitle}.`, "success");
        });

        tab.browserElement.addEventListener("did-navigate", (event) => {
            updateTabUrlById(tab.id, event.url);
        });

        tab.browserElement.addEventListener("did-navigate-in-page", (event) => {
            updateTabUrlById(tab.id, event.url);
        });

        tab.browserElement.addEventListener("did-fail-load", (event) => {
            if (event.errorCode === -3) {
                return;
            }

            console.error("Browser tab failed to load:", event);
            updateTabTitleById(tab.id, "Failed to load");
            setBrowserStatus(`Could not load ${tab.url}.`, "error");
        });

        return;
    }

    tab.browserElement.addEventListener("load", () => {
        updateTabTitleById(tab.id, getFallbackTitle(tab.url));
        setBrowserStatus(`Loaded ${getFallbackTitle(tab.url)}.`, "success");
    });

    tab.browserElement.addEventListener("error", () => {
        setBrowserStatus(`Could not load ${tab.url}.`, "error");
    });
}

function renderTabs() {
    if (!uiRefs.tabsContainer) {
        return;
    }

    uiRefs.tabsContainer.replaceChildren();

    appState.tabs.forEach((tab, index) => {
        const tabElement = document.createElement("div");
        tabElement.className = `tab${tab.id === appState.activeTabId ? " active" : ""}`;

        const tabButton = document.createElement("button");
        tabButton.type = "button";
        tabButton.className = "tab-button";
        tabButton.setAttribute("role", "tab");
        tabButton.setAttribute("aria-selected", String(tab.id === appState.activeTabId));
        tabButton.textContent = tab.title;
        tabButton.addEventListener("click", () => switchTab(index));

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "tab-close";
        closeButton.setAttribute("aria-label", `Close ${tab.title}`);
        closeButton.textContent = "x";
        closeButton.addEventListener("click", (event) => {
            event.stopPropagation();
            closeTab(index);
        });

        tabElement.append(tabButton, closeButton);
        uiRefs.tabsContainer.appendChild(tabElement);
    });

    updateBrowserTitle();
}

function addTab(initialUrl = HOME_URL) {
    const url = normalizeUrl(initialUrl);
    const tab = {
        id: `tab-${appState.nextTabId++}`,
        title: getFallbackTitle(url),
        url,
        kind: isHomeUrl(url) ? "desktop" : "web",
        browserElement: null
    };

    appState.tabs.push(tab);
    replaceTabBrowserElement(tab, url);
    switchTab(appState.tabs.length - 1);
    setBrowserStatus(`Opened ${tab.title}.`, "info");
}

function switchTab(index) {
    if (index < 0 || index >= appState.tabs.length) {
        return;
    }

    appState.activeTabId = appState.tabs[index].id;
    appState.tabs.forEach((tab) => {
        tab.browserElement.classList.toggle("active", tab.id === appState.activeTabId);
    });
    renderTabs();
}

function closeTab(index) {
    if (index < 0 || index >= appState.tabs.length) {
        return;
    }

    const [removedTab] = appState.tabs.splice(index, 1);
    removedTab.browserElement.remove();

    if (appState.tabs.length === 0) {
        appState.activeTabId = null;
        addTab(HOME_URL);
        return;
    }

    switchTab(Math.max(0, Math.min(index, appState.tabs.length - 1)));
}

function openUrlInActiveTab(rawValue) {
    const activeTab = getActiveTab();
    if (!activeTab) {
        addTab(rawValue);
        return;
    }

    openUrlInTab(activeTab.id, rawValue);
}

function openUrlInTab(tabId, rawValue) {
    const tabIndex = getTabIndexById(tabId);
    if (tabIndex === -1) {
        return;
    }

    const tab = appState.tabs[tabIndex];
    const nextUrl = normalizeUrl(rawValue);

    if (isHomeUrl(nextUrl)) {
        tab.url = HOME_URL;
        tab.title = HOME_TITLE;

        if (tab.kind !== "desktop") {
            replaceTabBrowserElement(tab, HOME_URL);
        } else {
            tab.browserElement?.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }

        renderTabs();
        updateBrowserTitle();
        setBrowserStatus("JohnyBrowserHub desktop opened.", "success");
        return;
    }

    tab.url = nextUrl;
    tab.title = "Loading...";

    if (tab.kind !== "web") {
        replaceTabBrowserElement(tab, nextUrl);
    } else {
        tab.browserElement.src = nextUrl;
    }

    renderTabs();
    updateBrowserTitle();
    setBrowserStatus(`Loading ${nextUrl}...`, "info");
}

function initializeBrowserUi() {
    if (appState.browserInitialized) {
        return;
    }

    appState.browserInitialized = true;

    uiRefs.addTabButton?.addEventListener("click", () => addTab(HOME_URL));
    uiRefs.addressForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        openUrlInActiveTab(uiRefs.addressInput?.value || "");
    });

    document.querySelectorAll("[data-open-url]").forEach((button) => {
        button.addEventListener("click", () => {
            addTab(button.dataset.openUrl || HOME_URL);
        });
    });

    addTab(HOME_URL);
}

function createDownloadCard(item, typeLabel) {
    const article = document.createElement("article");
    article.className = "download-card";

    const headingWrap = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "download-card-title";
    title.textContent = item.name;

    const meta = document.createElement("p");
    meta.className = "download-card-meta";
    meta.textContent = typeLabel;

    const description = document.createElement("p");
    description.className = "download-card-description";
    description.textContent = item.description || "Official download and product links.";

    headingWrap.append(title, meta, description);

    const tags = document.createElement("div");
    tags.className = "download-tags";
    (item.tags || []).slice(0, 4).forEach((tag) => {
        const pill = document.createElement("span");
        pill.className = "download-tag";
        pill.textContent = tag;
        tags.appendChild(pill);
    });

    if (item.builtInVpn) {
        const badge = document.createElement("span");
        badge.className = "download-tag";
        badge.textContent = "Built-in VPN";
        tags.appendChild(badge);
    }

    const actions = document.createElement("div");
    actions.className = "download-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "primary-button";
    downloadButton.textContent = "Open download";
    downloadButton.addEventListener("click", async () => {
        setDownloadsStatus(`Opening ${item.name} download page...`, "info");
        await openExternalUrl(item.downloadUrl);
    });

    actions.appendChild(downloadButton);

    if (item.siteUrl) {
        const siteButton = document.createElement("button");
        siteButton.type = "button";
        siteButton.className = "ghost-button";
        siteButton.textContent = "Official site";
        siteButton.addEventListener("click", async () => {
            setDownloadsStatus(`Opening ${item.name} website...`, "info");
            await openExternalUrl(item.siteUrl);
        });
        actions.appendChild(siteButton);
    }

    article.append(headingWrap, tags, actions);
    return article;
}

async function initializeDownloadsUi() {
    if (appState.downloadsInitialized) {
        return;
    }

    appState.downloadsInitialized = true;
    setDownloadsStatus("Loading download recommendations...", "info");

    try {
        const response = await fetch("apps.json", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Could not load apps.json");
        }

        const catalog = await response.json();
        const vpnItems = Array.isArray(catalog.vpnApps) ? catalog.vpnApps : [];
        const browserItems = Array.isArray(catalog.browsers) ? catalog.browsers : [];

        uiRefs.vpnDownloads?.replaceChildren(...vpnItems.map((item) => createDownloadCard(item, "VPN app")));
        uiRefs.browserDownloads?.replaceChildren(...browserItems.map((item) => createDownloadCard(item, "Browser")));

        if (vpnItems.length === 0 && uiRefs.vpnDownloads) {
            const empty = document.createElement("div");
            empty.className = "download-empty";
            empty.textContent = "No VPN downloads are available right now.";
            uiRefs.vpnDownloads.appendChild(empty);
        }

        if (browserItems.length === 0 && uiRefs.browserDownloads) {
            const empty = document.createElement("div");
            empty.className = "download-empty";
            empty.textContent = "No browser downloads are available right now.";
            uiRefs.browserDownloads.appendChild(empty);
        }

        setDownloadsStatus("Download recommendations are ready.", "success");
    } catch (error) {
        console.error("Downloads page failed to load:", error);
        setDownloadsStatus("Could not load download recommendations. Please try again.", "error");
    }
}

function collectCommonShellRefs() {
    uiRefs.sessionAvatar = document.getElementById("session-avatar");
    uiRefs.sessionUser = document.getElementById("session-user");
    uiRefs.sessionEmail = document.getElementById("session-email");
    uiRefs.signOutButton = document.getElementById("sign-out-button");
    uiRefs.menuToggle = document.getElementById("menu-toggle");
    uiRefs.menuOverlay = document.getElementById("menu-overlay");
    uiRefs.sideMenu = document.getElementById("side-menu");
    uiRefs.menuCloseButton = document.getElementById("menu-close");
    uiRefs.menuHomePanel = document.getElementById("menu-home-panel");
    uiRefs.menuProfilePanel = document.getElementById("menu-profile-panel");
    uiRefs.menuAboutPanel = document.getElementById("menu-about-panel");
    uiRefs.menuProfileButton = document.getElementById("menu-profile-button");
    uiRefs.menuAboutButton = document.getElementById("menu-about-button");
    uiRefs.menuProfileAvatar = document.getElementById("menu-profile-avatar");
    uiRefs.menuProfileName = document.getElementById("menu-profile-name");
    uiRefs.serviceAiChatButton = document.getElementById("service-ai-chat");
    uiRefs.serviceDownloadsButton = document.getElementById("service-downloads");
    uiRefs.serviceBrowserButton = document.getElementById("service-browser");
    uiRefs.serviceSchoolSystemButton = document.getElementById("service-school-system");
    uiRefs.profileBackButton = document.getElementById("profile-back-button");
    uiRefs.aboutBackButton = document.getElementById("about-back-button");
    uiRefs.profileNameInput = document.getElementById("profile-name-input");
    uiRefs.profileAvatarPreview = document.getElementById("profile-avatar-preview");
    uiRefs.profileEmojiGrid = document.getElementById("profile-emoji-grid");
    uiRefs.profileSaveButton = document.getElementById("profile-save-button");
    uiRefs.profileDeleteButton = document.getElementById("profile-delete-button");
    uiRefs.profileSaveNote = document.getElementById("profile-save-note");
    uiRefs.schoolStatus = document.getElementById("school-status");
    uiRefs.schoolName = document.getElementById("school-name");
    uiRefs.schoolRole = document.getElementById("school-role");
    uiRefs.schoolIdentifier = document.getElementById("school-identifier");
    uiRefs.schoolStudentsCount = document.getElementById("school-students-count");
    uiRefs.schoolClassesCount = document.getElementById("school-classes-count");
    uiRefs.schoolTeachersCount = document.getElementById("school-teachers-count");
    uiRefs.schoolReportsCount = document.getElementById("school-reports-count");
    uiRefs.schoolAccessPanel = document.getElementById("school-access-panel");
    uiRefs.schoolStudentsPanel = document.getElementById("school-students-panel");
    uiRefs.schoolClassesPanel = document.getElementById("school-classes-panel");
    uiRefs.schoolTeachersPanel = document.getElementById("school-teachers-panel");
    uiRefs.schoolModulesPanel = document.getElementById("school-modules-panel");
    uiRefs.schoolReportsPanel = document.getElementById("school-reports-panel");
}

function initializeAuthPage() {
    const authFlow = getAuthFlowConfig();
    uiRefs.authButton = document.getElementById("google-signin-button");
    uiRefs.authGoogleButtons = Array.from(document.querySelectorAll("[data-google-auth]"));
    uiRefs.authStatus = document.getElementById("auth-status");
    uiRefs.authSignupPanel = document.getElementById("signup-panel");
    uiRefs.authLoginPanel = document.getElementById("login-panel");
    uiRefs.authSignupEmailButton = document.getElementById("signup-email-toggle");
    uiRefs.authLoginEmailButton = document.getElementById("login-email-toggle");
    uiRefs.authSignupForm = document.getElementById("signup-form");
    uiRefs.authSignupRoleCopy = document.getElementById("signup-role-copy");
    uiRefs.authDosTabButton = document.getElementById("signup-dos-tab");
    uiRefs.authTeacherTabButton = document.getElementById("signup-teacher-tab");
    uiRefs.authDosForm = document.getElementById("signup-dos-form");
    uiRefs.authDosNameInput = document.getElementById("signup-dos-name");
    uiRefs.authDosEmailInput = document.getElementById("signup-dos-email");
    uiRefs.authDosPasswordInput = document.getElementById("signup-dos-password");
    uiRefs.authDosSubmitButton = document.getElementById("signup-dos-submit-button");
    uiRefs.authTeacherForm = document.getElementById("signup-teacher-form");
    uiRefs.authTeacherNameInput = document.getElementById("signup-teacher-name");
    uiRefs.authTeacherEmailInput = document.getElementById("signup-teacher-email");
    uiRefs.authTeacherPasswordInput = document.getElementById("signup-teacher-password");
    uiRefs.authTeacherTitleSelect = document.getElementById("signup-teacher-title");
    uiRefs.authTeacherModuleNameInput = document.getElementById("signup-teacher-module-name");
    uiRefs.authTeacherModuleCategorySelect = document.getElementById("signup-teacher-module-category");
    uiRefs.authTeacherClassIdInput = document.getElementById("signup-teacher-class-id");
    uiRefs.authTeacherSubmitButton = document.getElementById("signup-teacher-submit-button");
    uiRefs.authLoginForm = document.getElementById("login-form");
    uiRefs.authLoginEmailInput = document.getElementById("login-email");
    uiRefs.authLoginPasswordInput = document.getElementById("login-password");
    uiRefs.authLoginSubmitButton = document.getElementById("login-submit-button");
    uiRefs.authForgotPasswordButton = document.getElementById("forgot-password-button");
    uiRefs.authLoginLink = document.getElementById("auth-go-login");
    uiRefs.authSignupLink = document.getElementById("auth-go-signup");

    if (uiRefs.authGoogleButtons.length === 0 && !uiRefs.authLoginForm && !uiRefs.authSignupForm) {
        return;
    }

    uiRefs.authGoogleButtons.forEach((button) => {
        button.addEventListener("click", loginWithGoogle);
    });

    uiRefs.authSignupEmailButton?.addEventListener("click", () => {
        openSignupForm({ focus: true });
        setAuthStatus("Complete the sign-up form to create your account.", "info");
    });

    uiRefs.authLoginEmailButton?.addEventListener("click", () => {
        focusLoginForm({ focus: true });
        setAuthStatus("Enter your email address and password to log in.", "info");
    });

    uiRefs.authDosTabButton?.addEventListener("click", () => {
        setRegistrationMode("dos");
        setAuthStatus("Complete the DOS registration form to create a DOS account.", "info");
    });
    uiRefs.authTeacherTabButton?.addEventListener("click", () => {
        setRegistrationMode("teacher");
        setAuthStatus("Complete the Teacher registration form to create a teacher account.", "info");
    });
    uiRefs.authDosForm?.addEventListener("submit", handleDosSignupSubmit);
    uiRefs.authTeacherForm?.addEventListener("submit", handleTeacherSignupSubmit);
    uiRefs.authLoginForm?.addEventListener("submit", handleEmailLoginSubmit);
    uiRefs.authForgotPasswordButton?.addEventListener("click", handleForgotPassword);

    uiRefs.authLoginLink?.addEventListener("click", () => {
        focusLoginForm({ focus: true });
    });

    uiRefs.authSignupLink?.addEventListener("click", () => {
        openSignupForm({ focus: true });
    });

    if (isSchoolRegistrationExperience()) {
        openSignupForm({ focus: true });
    } else {
        setActiveAuthPanel("login");
    }
    setRegistrationMode("dos");
    setAuthButtonPending(true);
    setAuthStatus("Checking your saved session...", "info");

    withServiceLoading("Checking your saved session...", async () => {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            await result.user.getIdToken();
            setAuthStatus(authFlow.googleSuccessCopy, "success");
            replaceTo(authFlow.destinationPage, {}, {
                loadingMessage: authFlow.destinationLoadingMessage,
                minDurationMs: AUTH_SUCCESS_LOADING_DURATION_MS
            });
            return;
        }

        await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();

                if (user) {
                    setAuthStatus(authFlow.existingSessionCopy, "success");
                    replaceTo(authFlow.destinationPage);
                    resolve();
                    return;
                }

                setAuthButtonPending(false);
                setAuthStatus(authFlow.idleStatusCopy, "info");
                void completePendingNavigationLoading({ skipDelay: true });
                resolve();
            });
        });
    }).catch((error) => {
        const message = getAuthErrorMessage(error);
        console.error("Firebase redirect result failed:", error);
        setAuthStatus(message, "error");
        window.alert(message);
        setAuthButtonPending(false);
        void completePendingNavigationLoading({ skipDelay: true });
    });
}

function initializeBrowserPage() {
    collectCommonShellRefs();
    uiRefs.tabsContainer = document.getElementById("tabs");
    uiRefs.viewsContainer = document.getElementById("browser-views");
    uiRefs.addressForm = document.getElementById("address-form");
    uiRefs.addressInput = document.getElementById("address-input");
    uiRefs.addTabButton = document.getElementById("add-tab-button");
    uiRefs.browserStatus = document.getElementById("browser-status");
    uiRefs.chatToggle = document.getElementById("ai-chat-toggle");
    uiRefs.chatPanel = document.getElementById("ai-chat-panel");
    uiRefs.chatMessages = document.getElementById("ai-chat-messages");
    uiRefs.chatForm = document.getElementById("ai-chat-form");
    uiRefs.chatInput = document.getElementById("ai-chat-input");
    uiRefs.chatSendButton = document.getElementById("ai-chat-send");
    uiRefs.chatCloseButton = document.getElementById("ai-chat-close");
    setBrowserStatus("Checking authentication state...", "info");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            setBrowserStatus("No Google session found. Redirecting to login...", "error");
            replaceTo(LOGIN_PAGE);
            return;
        }

        try {
            await withServiceLoading("Loading your browser workspace...", async () => {
                appState.currentUser = user;
                await loadUserModel(user);
                loadProfileForUser(user);
                initializeShellUi();
                updateSessionCard();
                initializeBrowserUi();
                initializeChatUi();
            });
            await completePendingNavigationLoading();
            setBrowserStatus("Google authentication verified. Browser ready.", "success");
        } catch (error) {
            console.error("Browser page initialization failed:", error);
            await completePendingNavigationLoading({ skipDelay: true });
            setBrowserStatus("Browser workspace could not be loaded right now.", "error");
        }
    });
}

function initializeDownloadsPage() {
    collectCommonShellRefs();
    uiRefs.downloadsStatus = document.getElementById("downloads-status");
    uiRefs.vpnDownloads = document.getElementById("vpn-downloads");
    uiRefs.browserDownloads = document.getElementById("browser-downloads");
    setDownloadsStatus("Checking authentication state...", "info");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            setDownloadsStatus("No Google session found. Redirecting to login...", "error");
            replaceTo(LOGIN_PAGE);
            return;
        }

        try {
            await withServiceLoading("Loading download services...", async () => {
                appState.currentUser = user;
                await loadUserModel(user);
                loadProfileForUser(user);
                initializeShellUi();
                updateSessionCard();
                await initializeDownloadsUi();
            });
            await completePendingNavigationLoading();
        } catch (error) {
            console.error("Downloads page initialization failed:", error);
            await completePendingNavigationLoading({ skipDelay: true });
            setDownloadsStatus("Downloads page could not be loaded right now.", "error");
        }
    });
}

function syncSchoolOverviewCounts(schoolStore) {
    schoolStore.subscribe("students", (items) => {
        if (uiRefs.schoolStudentsCount) {
            uiRefs.schoolStudentsCount.textContent = String(items.length);
        }
    });

    schoolStore.subscribe("classes", (items) => {
        if (uiRefs.schoolClassesCount) {
            uiRefs.schoolClassesCount.textContent = String(items.length);
        }
    });

    schoolStore.subscribe("teachers", (items) => {
        if (uiRefs.schoolTeachersCount) {
            uiRefs.schoolTeachersCount.textContent = String(items.length);
        }
    });

    schoolStore.subscribe("reports", (items) => {
        if (uiRefs.schoolReportsCount) {
            uiRefs.schoolReportsCount.textContent = String(items.length);
        }
    });
}

async function initializeSchoolDashboardUi() {
    if (appState.schoolDashboardInitialized) {
        return;
    }

    appState.schoolDashboardInitialized = true;

    if (uiRefs.schoolName) {
        uiRefs.schoolName.textContent = appState.currentUserModel.schoolName || "School Management";
    }

    if (uiRefs.schoolRole) {
        uiRefs.schoolRole.textContent = appState.currentUserModel.role;
    }

    const analyticsLink = document.getElementById("school-analytics-link");
    if (analyticsLink) {
        analyticsLink.hidden = appState.currentUserModel.role !== "dos";
    }

    if (uiRefs.schoolIdentifier) {
        uiRefs.schoolIdentifier.textContent = appState.currentUserModel.schoolId || "No school linked";
    }

    window.__JBNH_CURRENT_FIREBASE_UID__ = `${appState.currentUser?.uid || ""}`.trim();
    window.__JBNH_CURRENT_SCHOOL_EMAIL__ = `${appState.currentUser?.email || ""}`.trim().toLowerCase();
    window.__JBNH_CURRENT_SCHOOL_NAME__ = `${appState.profile?.username || appState.currentUserModel.displayName || ""}`.trim();
    window.__JBNH_CURRENT_SCHOOL_RESOLVED_NAME__ = `${appState.currentUserModel.schoolName || "School Management"}`.trim();
    window.__JBNH_CURRENT_SCHOOL_PROFILE_ID__ = `${appState.currentUser?.uid || ""}`.trim();

    if (!appState.currentUserModel.schoolId) {
        renderSchoolAccessPlaceholder({
            title: "School Management is ready for your account",
            description: "This logged-in profile can open the school service, but it is not linked to a school record yet. Add a schoolId to the user profile to unlock live school data and full dashboard tools."
        });
        setSchoolStatus("School Management opened. No school profile is linked to this account yet.", "info");
        return;
    }

    if (!["schoolAdmin", "dos"].includes(appState.currentUserModel.role)) {
        renderSchoolAccessPlaceholder({
            title: "School Management opened with role-based access",
            description: "This account is linked to a school and can access the School Management page. Full admin tools stay available to DOS and school administrators, while teacher or student-specific views can remain limited."
        });
        setSchoolStatus("School Management opened successfully for this signed-in account.", "success");
        return;
    }

    showFullSchoolDashboardPanels();
    document.querySelectorAll(".school-role-link").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".school-role-link").forEach((item) => {
                item.classList.toggle("is-active", item === link);
            });
        });
    });

    const [
        { createSchoolDataStore },
        { createAccessController },
        { createStudentsController },
        { createClassesController },
        { createTeachersController },
        { createModulesController },
        { createReportsController }
    ] = await Promise.all([
        import("./school/data-store.js"),
        import("./school/access-panel.js"),
        import("./school/students.js"),
        import("./school/classes.js"),
        import("./school/teachers.js"),
        import("./school/modules.js"),
        import("./school/reports.js")
    ]);

    appState.schoolDataStore?.destroy?.();
    appState.schoolDataStore = createSchoolDataStore({
        db,
        schoolId: appState.currentUserModel.schoolId,
        onStatusChange: setSchoolStatus
    });

    syncSchoolOverviewCounts(appState.schoolDataStore);

    const controllers = [
        createAccessController({
            schoolStore: appState.schoolDataStore,
            panel: uiRefs.schoolAccessPanel,
            onStatusChange: setSchoolStatus
        }),
        createStudentsController({
            schoolStore: appState.schoolDataStore,
            panel: uiRefs.schoolStudentsPanel,
            onStatusChange: setSchoolStatus
        }),
        createClassesController({
            schoolStore: appState.schoolDataStore,
            panel: uiRefs.schoolClassesPanel,
            onStatusChange: setSchoolStatus
        }),
        createTeachersController({
            schoolStore: appState.schoolDataStore,
            panel: uiRefs.schoolTeachersPanel,
            onStatusChange: setSchoolStatus
        }),
        createModulesController({
            schoolStore: appState.schoolDataStore,
            panel: uiRefs.schoolModulesPanel,
            onStatusChange: setSchoolStatus
        }),
        createReportsController({
            schoolStore: appState.schoolDataStore,
            panel: uiRefs.schoolReportsPanel,
            schoolName: appState.currentUserModel.schoolName || "JohnyBrowserHub School Management",
            onStatusChange: setSchoolStatus
        })
    ];

    controllers.forEach((controller) => {
        controller.init();
    });

    await appState.schoolDataStore.start();

    setSchoolStatus("School Management is live and connected to Firebase.", "success");
}

function initializeSchoolDashboardPage() {
    collectCommonShellRefs();
    setSchoolStatus("Checking school access...", "info");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            setSchoolStatus("No Google session found. Redirecting to login...", "error");
            replaceTo(LOGIN_PAGE);
            return;
        }

        try {
            await withServiceLoading("Loading School Management...", async () => {
                appState.currentUser = user;
                await loadUserModel(user);
                loadProfileForUser(user);
                initializeShellUi();
                updateSessionCard();
                await initializeSchoolDashboardUi();
            });
            await completePendingNavigationLoading();
        } catch (error) {
            console.error("School dashboard initialization failed:", error);
            await completePendingNavigationLoading({ skipDelay: true });
            setSchoolStatus("School Management could not be loaded right now.", "error");
        }
    });
}

export async function initializeJohnyBrowserHub() {
    appState.page = document.body?.dataset.page || "auth";
    ensureServiceLoadingUi();
    beginPendingNavigationLoading();

    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
        console.warn("Auth persistence fallback:", error);
    }

    if (appState.page === "browser") {
        initializeBrowserPage();
        return;
    }

    if (appState.page === "downloads") {
        initializeDownloadsPage();
        return;
    }

    if (appState.page === "school-dashboard") {
        initializeSchoolDashboardPage();
        return;
    }

    initializeAuthPage();
}

window.loginWithGoogle = loginWithGoogle;
window.addTab = addTab;
window.switchTab = switchTab;
window.closeTab = closeTab;
