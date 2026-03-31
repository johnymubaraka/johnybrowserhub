import {
    createUserWithEmailAndPassword,
    deleteUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
    auth,
    db,
    ensureSchoolPersistence,
    normalizeEmail,
    SCHOOL_ACCESS_SESSION_KEY,
    SCHOOL_SETTINGS_COLLECTION
} from "./firebase-context.js";

const SCHOOL_DASHBOARD_PAGE = "/school/dashboard.html";
const SCHOOL_TEACHER_PAGE = "/school/teacher.html";

const refs = {
    dosForm: null,
    dosEmailInput: null,
    dosPasswordInput: null,
    dosSignInButton: null,
    dosSignUpButton: null,
    teacherForm: null,
    teacherEmailInput: null,
    teacherPasswordInput: null,
    teacherSignInButton: null,
    status: null
};

function setStatus(message, state = "info") {
    if (!refs.status) {
        return;
    }

    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function setPending(isPending) {
    [
        refs.dosSignInButton,
        refs.dosSignUpButton,
        refs.teacherSignInButton,
        refs.dosEmailInput,
        refs.dosPasswordInput,
        refs.teacherEmailInput,
        refs.teacherPasswordInput
    ].forEach((element) => {
        if (element) {
            element.disabled = isPending;
        }
    });
}

function goTo(page) {
    const targetUrl = new URL(page, window.location.href).toString();
    if (window.location.href !== targetUrl) {
        window.location.href = targetUrl;
    }
}

function normalizeLoose(value = "") {
    return `${value || ""}`.trim().toLowerCase();
}

function getDisplayNameFromEmail(email) {
    const localPart = normalizeEmail(email).split("@")[0] || "dos";
    const words = localPart
        .replace(/[^a-z0-9]+/gi, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4);

    if (words.length === 0) {
        return "DOS";
    }

    return words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function getDefaultSchoolName(email) {
    return `${getDisplayNameFromEmail(email)} School`;
}

async function hashPasswordForStorage(password) {
    const encoded = new TextEncoder().encode(`${password || ""}`);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
}

async function findFirstByEmail(collectionName, email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return null;
    }

    const snapshot = await getDocs(query(
        collection(db, collectionName),
        where("email", "==", normalizedEmail),
        limit(10)
    ));

    return snapshot.empty
        ? null
        : {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        };
}

async function findRoleUser(email, role) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = role === "dos" ? "dos" : "teacher";

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
        : {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        };
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

async function ensureDosRegistrationAllowed(email) {
    const [teacherProfile, teacherUser] = await Promise.all([
        findFirstByEmail("teachers", email),
        findRoleUser(email, "teacher")
    ]);

    if (teacherProfile || teacherUser) {
        const error = new Error("That email is already being used by a teacher profile.");
        error.code = "auth/email-already-in-use";
        throw error;
    }
}

async function ensureDosProfile(email, passwordHash = "") {
    const normalizedEmail = normalizeEmail(email);
    const dosProfile = await findFirstByEmail("dos", normalizedEmail);
    const roleUser = await findRoleUser(normalizedEmail, "dos");

    if (!dosProfile && !roleUser) {
        throw new Error("This email is not registered as DOS in the School Management system yet.");
    }

    const schoolId = `${dosProfile?.schoolId || roleUser?.schoolId || auth.currentUser?.uid || ""}`.trim();
    const schoolName = `${dosProfile?.schoolName || roleUser?.schoolName || getDefaultSchoolName(normalizedEmail)}`.trim();
    const dosName = `${dosProfile?.name || roleUser?.name || auth.currentUser?.displayName || getDisplayNameFromEmail(normalizedEmail)}`.trim();

    let dosProfileId = `${dosProfile?.id || roleUser?.linkedProfileId || ""}`.trim();
    if (dosProfile?.id) {
        const nextPayload = {
            uid: `${auth.currentUser?.uid || dosProfile.uid || ""}`.trim(),
            email: normalizedEmail,
            role: "dos",
            name: dosName,
            schoolId,
            schoolName
        };

        if (passwordHash && !`${dosProfile.password || dosProfile.passwordHash || ""}`.trim()) {
            nextPayload.password = passwordHash;
            nextPayload.passwordHash = passwordHash;
        }

        await updateDoc(doc(db, "dos", dosProfile.id), {
            ...nextPayload,
            updatedAt: serverTimestamp()
        });
        dosProfileId = dosProfile.id;
    } else {
        const dosProfileRef = await addDoc(collection(db, "dos"), {
            uid: `${auth.currentUser?.uid || ""}`.trim(),
            email: normalizedEmail,
            role: "dos",
            name: dosName,
            schoolId,
            schoolName,
            password: passwordHash,
            passwordHash,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        dosProfileId = dosProfileRef.id;
    }

    if (roleUser?.id) {
        await updateDoc(doc(db, "users", roleUser.id), {
            role: "dos",
            email: normalizedEmail,
            name: dosName,
            schoolId,
            schoolName,
            linkedProfileId: dosProfileId,
            uid: `${auth.currentUser?.uid || roleUser.uid || ""}`.trim(),
            updatedAt: serverTimestamp()
        });
    } else {
        await addDoc(collection(db, "users"), {
            role: "dos",
            email: normalizedEmail,
            name: dosName,
            schoolId,
            schoolName,
            linkedProfileId: dosProfileId,
            uid: `${auth.currentUser?.uid || ""}`.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }

    const currentSettings = await getSchoolSettingsForSchool(schoolId);
    if (!currentSettings) {
        await addDoc(collection(db, SCHOOL_SETTINGS_COLLECTION), {
            schoolId,
            schoolName,
            accessCode: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } else if (!`${currentSettings.schoolName || ""}`.trim()) {
        await updateDoc(doc(db, SCHOOL_SETTINGS_COLLECTION, currentSettings.id), {
            schoolName,
            updatedAt: serverTimestamp()
        });
    }

    return {
        schoolId,
        schoolName,
        dosId: dosProfileId,
        dosName
    };
}

async function createDosProfile(email, passwordHash) {
    const normalizedEmail = normalizeEmail(email);
    const existingDosProfile = await findFirstByEmail("dos", normalizedEmail);
    const existingRoleUser = await findRoleUser(normalizedEmail, "dos");
    const schoolId = `${existingDosProfile?.schoolId || existingRoleUser?.schoolId || auth.currentUser?.uid || ""}`.trim();
    const schoolName = `${existingDosProfile?.schoolName || existingRoleUser?.schoolName || getDefaultSchoolName(normalizedEmail)}`.trim();
    const dosName = `${existingDosProfile?.name || existingRoleUser?.name || auth.currentUser?.displayName || getDisplayNameFromEmail(normalizedEmail)}`.trim();

    let dosProfileId = `${existingDosProfile?.id || existingRoleUser?.linkedProfileId || ""}`.trim();
    if (existingDosProfile?.id) {
        await updateDoc(doc(db, "dos", existingDosProfile.id), {
            uid: `${auth.currentUser?.uid || existingDosProfile.uid || ""}`.trim(),
            email: normalizedEmail,
            role: "dos",
            name: dosName,
            schoolId,
            schoolName,
            password: passwordHash,
            passwordHash,
            updatedAt: serverTimestamp()
        });
        dosProfileId = existingDosProfile.id;
    } else {
        const dosProfileRef = await addDoc(collection(db, "dos"), {
            uid: `${auth.currentUser?.uid || ""}`.trim(),
            email: normalizedEmail,
            role: "dos",
            name: dosName,
            schoolId,
            schoolName,
            password: passwordHash,
            passwordHash,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        dosProfileId = dosProfileRef.id;
    }

    if (existingRoleUser?.id) {
        await updateDoc(doc(db, "users", existingRoleUser.id), {
            role: "dos",
            email: normalizedEmail,
            name: dosName,
            schoolId,
            schoolName,
            linkedProfileId: dosProfileId,
            uid: `${auth.currentUser?.uid || existingRoleUser.uid || ""}`.trim(),
            updatedAt: serverTimestamp()
        });
    } else {
        await addDoc(collection(db, "users"), {
            role: "dos",
            email: normalizedEmail,
            name: dosName,
            schoolId,
            schoolName,
            linkedProfileId: dosProfileId,
            uid: `${auth.currentUser?.uid || ""}`.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }

    const currentSettings = await getSchoolSettingsForSchool(schoolId);
    if (!currentSettings) {
        await addDoc(collection(db, SCHOOL_SETTINGS_COLLECTION), {
            schoolId,
            schoolName,
            accessCode: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } else if (!`${currentSettings.schoolName || ""}`.trim()) {
        await updateDoc(doc(db, SCHOOL_SETTINGS_COLLECTION, currentSettings.id), {
            schoolName,
            updatedAt: serverTimestamp()
        });
    }

    return {
        schoolId,
        schoolName,
        dosId: dosProfileId,
        dosName
    };
}

async function doesPasswordMatch(secret, ...values) {
    const normalizedSecret = `${secret || ""}`.trim();
    if (!normalizedSecret) {
        return false;
    }

    const hashedSecret = await hashPasswordForStorage(normalizedSecret);
    return values.some((value) => {
        const candidate = `${value || ""}`.trim();
        return Boolean(candidate) && (candidate === normalizedSecret || candidate === hashedSecret);
    });
}

async function resolveTeacherAccessProfile(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const [teacherProfile, roleUser] = await Promise.all([
        findFirstByEmail("teachers", normalizedEmail),
        findRoleUser(normalizedEmail, "teacher")
    ]);

    if (!teacherProfile && !roleUser) {
        throw new Error("This email is not registered as a teacher in the School Management system yet.");
    }

    const hasMatchingPassword = await doesPasswordMatch(
        password,
        teacherProfile?.password,
        teacherProfile?.passwordHash,
        teacherProfile?.accessCode,
        roleUser?.password,
        roleUser?.passwordHash,
        roleUser?.accessCode
    );

    if (!hasMatchingPassword) {
        throw new Error("The teacher email or password is incorrect.");
    }

    const schoolId = `${teacherProfile?.schoolId || roleUser?.schoolId || ""}`.trim();
    const settings = await getSchoolSettingsForSchool(schoolId);
    const schoolName = `${settings?.schoolName || teacherProfile?.schoolName || roleUser?.schoolName || "School Management"}`.trim();

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
        const emailMatches = normalizedEmail
            ? normalizeLoose(moduleItem.teacherEmail) === normalizedEmail
            : false;
        const linkedProfileMatches = roleUser?.linkedProfileId
            ? moduleItem.teacherId === roleUser.linkedProfileId
            : false;
        return teacherMatches || subjectMatches || emailMatches || linkedProfileMatches;
    }) || null;

    if (!assignedModule) {
        throw new Error("No module is currently assigned to this teacher. Ask DOS to assign a module first.");
    }

    const classId = `${teacherProfile?.classId || assignedModule.classId || roleUser?.classId || ""}`.trim();
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
    const classItem = classItems.find((item) => item.id === classId)
        || classItems.find((item) => normalizeLoose(item.className) === normalizeLoose(teacherProfile?.className))
        || null;

    if (!classItem) {
        throw new Error("No class is currently linked to this teacher. Ask DOS to create or assign the class first.");
    }

    return {
        roleUser,
        teacherProfile,
        schoolId,
        schoolName,
        assignedModule,
        classItem
    };
}

function saveDosSession({ schoolId, schoolName, dosId, dosName, dosEmail }) {
    window.localStorage.setItem(SCHOOL_ACCESS_SESSION_KEY, JSON.stringify({
        mode: "dos",
        schoolId,
        schoolName,
        dosId,
        dosEmail: normalizeEmail(dosEmail),
        dosName
    }));
}

function saveTeacherSession({ schoolId, schoolName, teacherId, teacherName, teacherEmail, classItem, moduleItem, dosId }) {
    window.localStorage.setItem(SCHOOL_ACCESS_SESSION_KEY, JSON.stringify({
        mode: "teacher",
        schoolId,
        schoolName,
        teacherId,
        teacherName,
        teacherEmail: normalizeEmail(teacherEmail),
        classId: classItem.id,
        className: classItem.className || "",
        level: classItem.level || "",
        sector: classItem.sector || "",
        trade: classItem.trade || "",
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName || "",
        moduleCategory: moduleItem.moduleCategory || "general",
        dosId: `${dosId || ""}`.trim()
    }));
}

async function handleDosSignIn(event) {
    event.preventDefault();

    const email = normalizeEmail(refs.dosEmailInput?.value);
    const password = `${refs.dosPasswordInput?.value || ""}`.trim();

    if (!email || !password) {
        setStatus("Enter the DOS email and password before signing in.", "error");
        return;
    }

    setPending(true);
    setStatus("Signing in DOS...", "info");

    let didAuthenticate = false;
    try {
        const passwordHash = await hashPasswordForStorage(password);
        await signInWithEmailAndPassword(auth, email, password);
        didAuthenticate = true;
        const resolved = await ensureDosProfile(email, passwordHash);

        saveDosSession({
            ...resolved,
            dosEmail: email
        });

        goTo(SCHOOL_DASHBOARD_PAGE);
    } catch (error) {
        console.error("DOS sign-in failed:", error);
        if (didAuthenticate) {
            await signOut(auth).catch(() => {});
        }
        const message = error?.message || "DOS sign-in could not be completed.";
        setStatus(message, "error");
        window.alert(message);
    } finally {
        setPending(false);
    }
}

async function handleDosSignUp() {
    const email = normalizeEmail(refs.dosEmailInput?.value);
    const password = `${refs.dosPasswordInput?.value || ""}`.trim();

    if (!email || !password) {
        setStatus("Enter the DOS email and password before signing up.", "error");
        return;
    }

    if (password.length < 6) {
        setStatus("DOS password must be at least 6 characters long.", "error");
        return;
    }

    setPending(true);
    setStatus("Creating DOS School Management access...", "info");

    try {
        await ensureDosRegistrationAllowed(email);

        const passwordHash = await hashPasswordForStorage(password);
        const displayName = getDisplayNameFromEmail(email);
        const credential = await createUserWithEmailAndPassword(auth, email, password);

        try {
            await updateProfile(credential.user, {
                displayName
            });

            const resolved = await createDosProfile(email, passwordHash);
            saveDosSession({
                ...resolved,
                dosEmail: email
            });

            goTo(SCHOOL_DASHBOARD_PAGE);
        } catch (error) {
            await deleteUser(credential.user).catch(() => {});
            throw error;
        }
    } catch (error) {
        console.error("DOS sign-up failed:", error);
        const message = error?.message || "DOS sign-up could not be completed.";
        setStatus(message, "error");
        window.alert(message);
    } finally {
        setPending(false);
    }
}

async function handleTeacherSignIn(event) {
    event.preventDefault();

    const email = normalizeEmail(refs.teacherEmailInput?.value);
    const password = `${refs.teacherPasswordInput?.value || ""}`.trim();

    if (!email || !password) {
        setStatus("Enter the teacher email and password before signing in.", "error");
        return;
    }

    setPending(true);
    setStatus("Opening the teacher page...", "info");

    try {
        const resolved = await resolveTeacherAccessProfile(email, password);
        const teacherName = `${resolved.teacherProfile?.fullName || resolved.roleUser?.name || "Teacher"}`.trim();

        saveTeacherSession({
            schoolId: resolved.schoolId,
            schoolName: resolved.schoolName,
            teacherId: resolved.teacherProfile?.id || resolved.roleUser?.linkedProfileId || resolved.roleUser?.id || "",
            teacherName,
            teacherEmail: email,
            classItem: resolved.classItem,
            moduleItem: resolved.assignedModule,
            dosId: resolved.roleUser?.dosId || resolved.teacherProfile?.dosId || ""
        });

        goTo(SCHOOL_TEACHER_PAGE);
    } catch (error) {
        console.error("Teacher sign-in failed:", error);
        const message = error?.message || "Teacher sign-in could not be completed.";
        setStatus(message, "error");
        window.alert(message);
    } finally {
        setPending(false);
    }
}

function collectRefs() {
    refs.dosForm = document.getElementById("school-register-dos-form");
    refs.dosEmailInput = document.getElementById("school-register-dos-email");
    refs.dosPasswordInput = document.getElementById("school-register-dos-password");
    refs.dosSignInButton = document.getElementById("school-register-dos-signin");
    refs.dosSignUpButton = document.getElementById("school-register-dos-signup");
    refs.teacherForm = document.getElementById("school-register-teacher-form");
    refs.teacherEmailInput = document.getElementById("school-register-teacher-email");
    refs.teacherPasswordInput = document.getElementById("school-register-teacher-password");
    refs.teacherSignInButton = document.getElementById("school-register-teacher-signin");
    refs.status = document.getElementById("school-register-status");
}

async function initializeRegistrationPage() {
    collectRefs();
    await ensureSchoolPersistence();

    refs.dosForm?.addEventListener("submit", handleDosSignIn);
    refs.dosSignUpButton?.addEventListener("click", handleDosSignUp);
    refs.teacherForm?.addEventListener("submit", handleTeacherSignIn);

    onAuthStateChanged(auth, (user) => {
        const savedEmail = normalizeEmail(user?.email);
        if (savedEmail) {
            if (refs.dosEmailInput && !refs.dosEmailInput.value.trim()) {
                refs.dosEmailInput.value = savedEmail;
            }

            if (refs.teacherEmailInput && !refs.teacherEmailInput.value.trim()) {
                refs.teacherEmailInput.value = savedEmail;
            }
        }

        setStatus(
            "School Management is ready. DOS can sign in or sign up with email and password, and Teacher can sign in with email and password only.",
            "info"
        );
    });
}

window.addEventListener("DOMContentLoaded", () => {
    initializeRegistrationPage().catch((error) => {
        console.error("School registration page failed:", error);
        const fallbackMessage = error?.message
            ? `School Management registration could not be loaded: ${error.message}`
            : "School Management registration could not be loaded right now.";
        setStatus(fallbackMessage, "error");
    });
});
