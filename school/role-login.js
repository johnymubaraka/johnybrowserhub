import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
    collection,
    getDocs,
    limit,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
    auth,
    db,
    ensureSchoolPersistence,
    normalizeEmail,
    SCHOOL_ACCESS_SESSION_KEY,
    SCHOOL_SETTINGS_COLLECTION,
    toSlug
} from "./firebase-context.js";

const LOGIN_PAGE = "/index.html";
const SCHOOL_ACCESS_PAGE = "/school/auth.html";
const SCHOOL_DASHBOARD_PAGE = "/school/dashboard.html";
const SCHOOL_TEACHER_PAGE = "/school/teacher.html";

const refs = {
    form: null,
    emailInput: null,
    accessCodeInput: null,
    submitButton: null,
    status: null
};

function getMode() {
    return document.body?.dataset.roleLogin === "dos" ? "dos" : "teacher";
}

function setStatus(message, state = "info") {
    if (!refs.status) {
        return;
    }

    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function setPending(isPending) {
    if (!refs.submitButton) {
        return;
    }

    refs.submitButton.disabled = isPending;
}

function goTo(page) {
    const targetUrl = new URL(page, window.location.href).toString();
    if (window.location.href !== targetUrl) {
        window.location.href = targetUrl;
    }
}

function normalizeLoose(value) {
    return `${value || ""}`.trim().toLowerCase();
}

async function findFirstByEmail(collectionName, email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return null;
    }

    const snapshot = await getDocs(query(collection(db, collectionName), where("email", "==", normalizedEmail), limit(10)));
    return snapshot.empty
        ? null
        : snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
        }))[0];
}

async function findRoleUser(email, role) {
    const normalizedRole = role === "dos" ? "dos" : "teacher";
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return null;
    }

    const snapshot = await getDocs(query(
        collection(db, "users"),
        where("email", "==", normalizedEmail),
        where("role", "==", normalizedRole),
        limit(10)
    ));

    return snapshot.empty
        ? null
        : snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
        }))[0];
}

async function getSchoolSettingsForSchool(schoolId) {
    if (!schoolId) {
        return null;
    }

    const snapshot = await getDocs(query(
        collection(db, SCHOOL_SETTINGS_COLLECTION),
        where("schoolId", "==", schoolId),
        limit(1)
    ));

    return snapshot.empty
        ? null
        : {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        };
}

async function resolveDosAccessProfile(email) {
    const roleUser = await findRoleUser(email, "dos");
    const dosProfile = await findFirstByEmail("dos", email);
    const schoolId = `${roleUser?.schoolId || dosProfile?.schoolId || auth.currentUser?.uid || ""}`.trim();
    const schoolName = `${roleUser?.schoolName || dosProfile?.schoolName || `${auth.currentUser?.displayName || toSlug(email)} School`}`.trim();
    const settings = await getSchoolSettingsForSchool(schoolId);

    return {
        roleUser,
        dosProfile,
        schoolId,
        schoolName,
        settings
    };
}

async function resolveTeacherAccessProfile(email) {
    const roleUser = await findRoleUser(email, "teacher");
    const teacherProfile = await findFirstByEmail("teachers", email);

    if (!teacherProfile && !roleUser) {
        return null;
    }

    const schoolId = `${roleUser?.schoolId || teacherProfile?.schoolId || ""}`.trim();
    const schoolName = `${roleUser?.schoolName || teacherProfile?.schoolName || "School Management"}`.trim();
    const settings = await getSchoolSettingsForSchool(schoolId);

    const moduleSnapshot = schoolId
        ? await getDocs(query(
            collection(db, "modules"),
            where("schoolId", "==", schoolId),
            limit(50)
        ))
        : { docs: [] };

    const modules = moduleSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));

    const assignedModule = modules.find((moduleItem) => {
        const teacherMatches = teacherProfile?.id ? moduleItem.teacherId === teacherProfile.id : false;
        const subjectMatches = teacherProfile?.subject
            ? normalizeLoose(moduleItem.moduleName) === normalizeLoose(teacherProfile.subject)
            : false;
        const emailMatches = roleUser?.email ? normalizeLoose(moduleItem.teacherEmail) === normalizeLoose(roleUser.email) : false;
        return teacherMatches || subjectMatches || emailMatches;
    }) || null;

    const classId = `${teacherProfile?.classId || assignedModule?.classId || roleUser?.classId || ""}`.trim();
    const classSnapshot = schoolId
        ? await getDocs(query(
            collection(db, "classes"),
            where("schoolId", "==", schoolId),
            limit(50)
        ))
        : { docs: [] };
    const classItems = classSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));
    const classItem = classItems.find((item) => item.id === classId) || null;

    return {
        roleUser,
        teacherProfile,
        schoolId,
        schoolName,
        settings,
        assignedModule,
        classItem
    };
}

async function handleDosLogin(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
    const resolved = await resolveDosAccessProfile(email);

    if (!resolved?.dosProfile && !resolved?.roleUser) {
        await signOut(auth).catch(() => {});
        throw new Error("This email is not registered as DOS in the School Management system yet.");
    }

    window.localStorage.setItem(SCHOOL_ACCESS_SESSION_KEY, JSON.stringify({
        mode: "dos",
        schoolId: resolved.schoolId,
        schoolName: resolved.schoolName,
        dosId: resolved.roleUser?.id || resolved.dosProfile?.id || auth.currentUser?.uid || "",
        dosEmail: normalizeEmail(email),
        dosName: resolved.roleUser?.name || resolved.dosProfile?.name || auth.currentUser?.displayName || "DOS"
    }));

    goTo(SCHOOL_DASHBOARD_PAGE);
}

async function handleTeacherLogin(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
    const resolved = await resolveTeacherAccessProfile(email);

    if (!resolved?.teacherProfile && !resolved?.roleUser) {
        await signOut(auth).catch(() => {});
        throw new Error("This email is not registered as a teacher in the School Management system yet.");
    }

    if (!resolved.assignedModule) {
        await signOut(auth).catch(() => {});
        throw new Error("No module is currently assigned to this teacher. Ask DOS to assign a module first.");
    }

    if (!resolved.classItem) {
        await signOut(auth).catch(() => {});
        throw new Error("No class is currently linked to this teacher. Ask DOS to create or assign the class first.");
    }

    window.localStorage.setItem(SCHOOL_ACCESS_SESSION_KEY, JSON.stringify({
        mode: "teacher",
        schoolId: resolved.schoolId,
        schoolName: resolved.schoolName,
        teacherId: resolved.teacherProfile?.id || resolved.roleUser?.linkedProfileId || resolved.roleUser?.id || "",
        teacherName: resolved.teacherProfile?.fullName || resolved.roleUser?.name || "Teacher",
        teacherEmail: normalizeEmail(email),
        classId: resolved.classItem.id,
        className: resolved.classItem.className || "",
        level: resolved.classItem.level || resolved.teacherProfile?.level || "",
        sector: resolved.classItem.sector || resolved.teacherProfile?.sector || "",
        trade: resolved.classItem.trade || resolved.teacherProfile?.trade || "",
        moduleId: resolved.assignedModule.id,
        moduleName: resolved.assignedModule.moduleName || resolved.teacherProfile?.subject || "",
        moduleCategory: resolved.assignedModule.moduleCategory || resolved.teacherProfile?.moduleCategory || "general",
        dosId: resolved.roleUser?.dosId || resolved.teacherProfile?.dosId || ""
    }));

    goTo(SCHOOL_TEACHER_PAGE);
}

async function handleSubmit(event) {
    event.preventDefault();

    const email = normalizeEmail(refs.emailInput?.value);
    const credential = `${refs.accessCodeInput?.value || ""}`.trim();
    const mode = getMode();

    if (!email || !credential) {
        setStatus("Enter the email and password before continuing.", "error");
        return;
    }

    setPending(true);
    setStatus(mode === "dos" ? "Signing in DOS..." : "Signing in Teacher...", "info");

    try {
        if (mode === "dos") {
            await handleDosLogin(email, credential);
            return;
        }

        await handleTeacherLogin(email, credential);
    } catch (error) {
        console.error(`${mode} login failed:`, error);
        const message = error?.message || `${mode === "dos" ? "DOS" : "Teacher"} access could not be confirmed.`;
        setStatus(message, "error");
        window.alert(message);
    } finally {
        setPending(false);
    }
}

function collectRefs() {
    refs.form = document.getElementById("school-role-login-form");
    refs.emailInput = document.getElementById("school-role-email");
    refs.accessCodeInput = document.getElementById("school-role-access-code");
    refs.submitButton = document.getElementById("school-role-submit");
    refs.status = document.getElementById("school-role-status");
}

async function initializeRoleLoginPage() {
    collectRefs();
    await ensureSchoolPersistence();

    refs.form?.addEventListener("submit", handleSubmit);

    onAuthStateChanged(auth, (user) => {
        if (user && refs.emailInput && !refs.emailInput.value.trim()) {
            refs.emailInput.value = normalizeEmail(user.email);
        }

        setStatus(
            getMode() === "dos"
                ? "Enter your DOS email and password to continue to the DOS dashboard."
                : "Enter your teacher email and password to continue to the teacher dashboard.",
            "info"
        );
    });
}

window.addEventListener("DOMContentLoaded", () => {
    initializeRoleLoginPage().catch((error) => {
        console.error("Role login page failed:", error);
        setStatus("School role login could not be loaded right now.", "error");
    });
});
