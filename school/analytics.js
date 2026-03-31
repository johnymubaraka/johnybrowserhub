import {
    onAuthStateChanged,
    signOut
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
import {
    downloadAnalyticsResultsCsv,
    generateAnalyticsResultsPdf
} from "./analytics-export.js";
import { withAppServiceLoading } from "./shared.js";

const REGISTER_PAGE = "/school/register.html";
const DASHBOARD_PAGE = "/school/dashboard.html";

const refs = {
    status: null,
    headerCopy: null,
    schoolCopy: null,
    sessionAvatar: null,
    sessionUser: null,
    sessionEmail: null,
    signOutButton: null,
    totalStudents: null,
    totalClasses: null,
    totalTeachers: null,
    totalModules: null,
    hardestSubjectName: null,
    hardestSubjectCopy: null,
    selectionCount: null,
    selectionCopy: null,
    downloadPdfButton: null,
    downloadCsvButton: null,
    classFilters: null,
    classChart: null,
    moduleChart: null,
    topStudentsBody: null
};

const state = {
    context: null,
    schoolSettingId: "",
    data: {
        schoolSettings: null,
        students: [],
        classes: [],
        teachers: [],
        modules: [],
        marks: [],
        reports: []
    },
    selectedClassIds: [],
    analyticsView: null
};

function setStatus(message, tone = "info") {
    if (!refs.status) {
        return;
    }

    refs.status.textContent = message;
    refs.status.dataset.state = tone;
}

function goTo(page) {
    const targetUrl = new URL(page, window.location.href).toString();
    if (window.location.href !== targetUrl) {
        window.location.href = targetUrl;
    }
}

function escapeHtml(value = "") {
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

function toNumber(value) {
    const parsed = Number.parseFloat(`${value ?? ""}`.trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercentage(value) {
    return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function getReportTotalMarks(report) {
    return toNumber(report?.totalMarks ?? report?.summary?.totalMarks);
}

function getReportPercentage(report) {
    return clampPercentage(toNumber(report?.percentage ?? report?.averageScore ?? report?.summary?.percentage ?? report?.summary?.averageScore));
}

function readSchoolAccessSession() {
    try {
        return JSON.parse(window.localStorage.getItem(SCHOOL_ACCESS_SESSION_KEY) || "null");
    } catch (error) {
        console.warn("School analytics session restore failed:", error);
        return null;
    }
}

function getAvatarLabel(name = "") {
    const normalizedName = `${name || ""}`.trim();
    return normalizedName ? normalizedName.charAt(0).toUpperCase() : "D";
}

async function findProfileByUser(collectionName, user) {
    if (!user) {
        return null;
    }

    if (user.uid) {
        const byUid = await getDocs(query(
            collection(db, collectionName),
            where("uid", "==", `${user.uid}`.trim()),
            limit(1)
        ));
        if (!byUid.empty) {
            return {
                id: byUid.docs[0].id,
                ...byUid.docs[0].data()
            };
        }
    }

    if (!user.email) {
        return null;
    }

    const byEmail = await getDocs(query(
        collection(db, collectionName),
        where("email", "==", normalizeEmail(user.email)),
        limit(1)
    ));
    if (byEmail.empty) {
        return null;
    }

    return {
        id: byEmail.docs[0].id,
        ...byEmail.docs[0].data()
    };
}

async function getSchoolSettingForSchool(schoolId) {
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

async function resolveDosContext(user) {
    const schoolSession = readSchoolAccessSession();
    const dosProfile = await findProfileByUser("dos", user);

    const sessionMatchesUser = schoolSession?.mode === "dos"
        && normalizeEmail(schoolSession?.dosEmail) === normalizeEmail(user?.email);

    if (!dosProfile && !sessionMatchesUser) {
        return null;
    }

    const schoolId = `${dosProfile?.schoolId || schoolSession?.schoolId || ""}`.trim();
    if (!schoolId) {
        return null;
    }

    const schoolSetting = await getSchoolSettingForSchool(schoolId);
    const schoolName = `${schoolSetting?.schoolName || dosProfile?.schoolName || schoolSession?.schoolName || "School Management"}`.trim();
    const dosName = `${dosProfile?.name || schoolSession?.dosName || user?.displayName || "DOS"}`.trim();
    const dosEmail = normalizeEmail(dosProfile?.email || schoolSession?.dosEmail || user?.email);

    return {
        schoolId,
        schoolName,
        dosName,
        dosEmail,
        schoolSetting
    };
}

function collectRefs() {
    refs.status = document.getElementById("school-analytics-status");
    refs.headerCopy = document.getElementById("school-analytics-header-copy");
    refs.schoolCopy = document.getElementById("school-analytics-school-copy");
    refs.sessionAvatar = document.getElementById("school-analytics-session-avatar");
    refs.sessionUser = document.getElementById("school-analytics-session-user");
    refs.sessionEmail = document.getElementById("school-analytics-session-email");
    refs.signOutButton = document.getElementById("school-analytics-sign-out");
    refs.totalStudents = document.getElementById("school-analytics-total-students");
    refs.totalClasses = document.getElementById("school-analytics-total-classes");
    refs.totalTeachers = document.getElementById("school-analytics-total-teachers");
    refs.totalModules = document.getElementById("school-analytics-total-modules");
    refs.hardestSubjectName = document.getElementById("school-analytics-hardest-subject-name");
    refs.hardestSubjectCopy = document.getElementById("school-analytics-hardest-subject-copy");
    refs.selectionCount = document.getElementById("school-analytics-selection-count");
    refs.selectionCopy = document.getElementById("school-analytics-selection-copy");
    refs.downloadPdfButton = document.getElementById("school-analytics-download-pdf");
    refs.downloadCsvButton = document.getElementById("school-analytics-download-csv");
    refs.classFilters = document.getElementById("school-analytics-class-filters");
    refs.classChart = document.getElementById("school-analytics-class-chart");
    refs.moduleChart = document.getElementById("school-analytics-module-chart");
    refs.topStudentsBody = document.getElementById("school-analytics-top-students-body");
}

function updateSessionUi() {
    const context = state.context || {};

    if (refs.sessionAvatar) {
        refs.sessionAvatar.textContent = getAvatarLabel(context.dosName);
    }
    if (refs.sessionUser) {
        refs.sessionUser.textContent = context.dosName || "DOS";
    }
    if (refs.sessionEmail) {
        refs.sessionEmail.textContent = context.dosEmail || "DOS analytics access";
    }
    if (refs.headerCopy) {
        refs.headerCopy.textContent = `${context.schoolName || "School Management"} analytics is available only to DOS.`;
    }
    if (refs.schoolCopy) {
        refs.schoolCopy.textContent = `Viewing analytics for ${context.schoolName || "the selected school"} across students, classes, teachers, modules, marks, and reports.`;
    }
}

function renderOverviewCards() {
    if (refs.totalStudents) {
        refs.totalStudents.textContent = String(state.data.students.length);
    }
    if (refs.totalClasses) {
        refs.totalClasses.textContent = String(state.data.classes.length);
    }
    if (refs.totalTeachers) {
        refs.totalTeachers.textContent = String(state.data.teachers.length);
    }
    if (refs.totalModules) {
        refs.totalModules.textContent = String(state.data.modules.length);
    }
}

function setExportButtonsEnabled(isEnabled) {
    if (refs.downloadPdfButton) {
        refs.downloadPdfButton.disabled = !isEnabled;
    }
    if (refs.downloadCsvButton) {
        refs.downloadCsvButton.disabled = !isEnabled;
    }
}

function getSelectedClassIdSet() {
    return new Set(state.selectedClassIds.map((value) => `${value || ""}`.trim()).filter(Boolean));
}

function getVisibleClasses() {
    const selectedClassIds = getSelectedClassIdSet();
    if (selectedClassIds.size === 0) {
        return [];
    }

    return state.data.classes.filter((classItem) => selectedClassIds.has(`${classItem.id || ""}`.trim()));
}

function buildAnalyticsSnapshot() {
    const visibleClasses = getVisibleClasses();
    const visibleClassIds = new Set(visibleClasses.map((classItem) => `${classItem.id || ""}`.trim()));
    const visibleStudents = state.data.students.filter((student) => visibleClassIds.has(`${student.classId || ""}`.trim()));
    const visibleStudentIds = new Set(visibleStudents.map((student) => `${student.id || ""}`.trim()));
    const visibleModules = state.data.modules.filter((moduleItem) => {
        const moduleClassId = `${moduleItem.classId || ""}`.trim();
        return !moduleClassId || visibleClassIds.has(moduleClassId);
    });
    const visibleModuleIds = new Set(visibleModules.map((moduleItem) => `${moduleItem.id || ""}`.trim()));
    const visibleMarks = state.data.marks.filter((mark) => {
        const markStudentId = `${mark.studentId || ""}`.trim();
        const markClassId = `${mark.classId || ""}`.trim();
        const markModuleId = `${mark.moduleId || ""}`.trim();
        return visibleStudentIds.has(markStudentId) || visibleClassIds.has(markClassId) || visibleModuleIds.has(markModuleId);
    });
    const visibleReports = state.data.reports.filter((report) => visibleClassIds.has(`${report.classId || ""}`.trim()));

    return {
        visibleClasses,
        visibleClassIds,
        visibleStudents,
        visibleStudentIds,
        visibleModules,
        visibleModuleIds,
        visibleMarks,
        visibleReports
    };
}

function buildClassPerformance(snapshot) {
    const studentClassById = new Map(snapshot.visibleStudents.map((student) => [`${student.id || ""}`.trim(), `${student.classId || ""}`.trim()]));
    const classStudentCount = new Map();
    snapshot.visibleStudents.forEach((student) => {
        const classId = `${student.classId || ""}`.trim();
        classStudentCount.set(classId, (classStudentCount.get(classId) || 0) + 1);
    });

    const totals = new Map(snapshot.visibleClasses.map((classItem) => [`${classItem.id || ""}`.trim(), {
        sum: 0,
        count: 0
    }]));

    snapshot.visibleMarks.forEach((mark) => {
        const classId = studentClassById.get(`${mark.studentId || ""}`.trim()) || `${mark.classId || ""}`.trim();
        if (!totals.has(classId)) {
            return;
        }

        const percentage = toNumber(mark.percentage);
        const hasPercentage = `${mark.percentage ?? ""}`.trim() !== "";
        if (!hasPercentage && percentage === 0) {
            return;
        }

        const entry = totals.get(classId);
        entry.sum += percentage;
        entry.count += 1;
    });

    return snapshot.visibleClasses.map((classItem) => {
        const classId = `${classItem.id || ""}`.trim();
        const totalsEntry = totals.get(classId) || { sum: 0, count: 0 };
        const average = totalsEntry.count > 0 ? clampPercentage(totalsEntry.sum / totalsEntry.count) : 0;

        return {
            id: classId,
            label: classItem.className || "Unnamed class",
            value: average,
            meta: [classItem.trade, classItem.level, classItem.sector].filter(Boolean).join(" • "),
            detail: `${classStudentCount.get(classId) || 0} students • ${totalsEntry.count} marks`
        };
    }).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function buildModulePerformance(snapshot) {
    const totals = new Map(snapshot.visibleModules.map((moduleItem) => [`${moduleItem.id || ""}`.trim(), {
        sum: 0,
        count: 0
    }]));

    snapshot.visibleMarks.forEach((mark) => {
        const moduleId = `${mark.moduleId || ""}`.trim();
        if (!totals.has(moduleId)) {
            return;
        }

        const percentage = toNumber(mark.percentage);
        const hasPercentage = `${mark.percentage ?? ""}`.trim() !== "";
        if (!hasPercentage && percentage === 0) {
            return;
        }

        const entry = totals.get(moduleId);
        entry.sum += percentage;
        entry.count += 1;
    });

    return snapshot.visibleModules.map((moduleItem) => {
        const moduleId = `${moduleItem.id || ""}`.trim();
        const totalsEntry = totals.get(moduleId) || { sum: 0, count: 0 };
        const average = totalsEntry.count > 0 ? clampPercentage(totalsEntry.sum / totalsEntry.count) : 0;

        return {
            id: moduleId,
            label: moduleItem.moduleName || "Unnamed module",
            value: average,
            meta: moduleItem.moduleCategory || "general",
            detail: `${totalsEntry.count} marks`
        };
    }).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function buildTopStudents(snapshot) {
    return [...snapshot.visibleReports]
        .sort((left, right) => getReportTotalMarks(right) - getReportTotalMarks(left))
        .slice(0, 5)
        .map((report, index) => ({
            rank: index + 1,
            studentName: report.studentName || "Unnamed student",
            className: report.className || "Unassigned class",
            totalMarks: getReportTotalMarks(report),
            percentage: getReportPercentage(report),
            position: report.position || "-"
        }));
}

function buildStudentPerformance(snapshot) {
    const classMap = new Map(state.data.classes.map((classItem) => [`${classItem.id || ""}`.trim(), classItem]));

    return [...snapshot.visibleReports]
        .map((report) => {
            const classItem = classMap.get(`${report.classId || ""}`.trim()) || null;

            return {
                studentName: report.studentName || "Unnamed student",
                trade: report.trade || classItem?.trade || report.className || "Unassigned class",
                level: report.level || classItem?.level || classItem?.className || "-",
                percentage: getReportPercentage(report),
                totalMarks: getReportTotalMarks(report),
                grade: `${report.finalGrade || report.grade || report.summary?.grade || ""}`.trim()
            };
        })
        .sort((left, right) => right.percentage - left.percentage || right.totalMarks - left.totalMarks || left.studentName.localeCompare(right.studentName));
}

function buildSelectionLabel(visibleClasses) {
    const names = (Array.isArray(visibleClasses) ? visibleClasses : [])
        .map((classItem) => `${classItem.className || "Unnamed class"}`.trim())
        .filter(Boolean);

    if (names.length === 0) {
        return "No classes selected";
    }

    if (names.length === state.data.classes.length) {
        return "All classes";
    }

    if (names.length <= 3) {
        return names.join(", ");
    }

    return `${names.length} selected classes (${names.slice(0, 2).join(", ")} +${names.length - 2} more)`;
}

function renderClassFilters() {
    if (!refs.classFilters) {
        return;
    }

    if (state.data.classes.length === 0) {
        refs.classFilters.innerHTML = `<div class="school-analytics-empty">No classes are available yet. Add classes first to activate analytics filters.</div>`;
        return;
    }

    const selectedClassIds = getSelectedClassIdSet();
    refs.classFilters.innerHTML = state.data.classes.map((classItem) => {
        const meta = [classItem.trade, classItem.level, classItem.sector].filter(Boolean).join(" • ");
        return `
            <label class="school-analytics-filter-option">
                <input type="checkbox" value="${escapeHtml(classItem.id)}" ${selectedClassIds.has(classItem.id) ? "checked" : ""}>
                <span class="school-analytics-filter-copy">
                    <strong>${escapeHtml(classItem.className || "Unnamed class")}</strong>
                    <span>${escapeHtml(meta || "Available for analytics")}</span>
                </span>
            </label>
        `;
    }).join("");

    refs.classFilters.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.addEventListener("change", handleClassSelectionChange);
    });
}

function renderBarChart(container, items, emptyMessage) {
    if (!container) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `<div class="school-analytics-empty">${escapeHtml(emptyMessage)}</div>`;
        return;
    }

    container.innerHTML = items.map((item) => `
        <article class="school-chart-row">
            <div class="school-chart-head">
                <div>
                    <h4>${escapeHtml(item.label)}</h4>
                    <p>${escapeHtml([item.meta, item.detail].filter(Boolean).join(" • "))}</p>
                </div>
                <strong>${escapeHtml(`${item.value.toFixed(1)}%`)}</strong>
            </div>
            <div class="school-chart-track">
                <div class="school-chart-fill" style="width:${escapeHtml(String(clampPercentage(item.value)))}%"></div>
            </div>
        </article>
    `).join("");
}

function renderTopStudents(rows) {
    if (!refs.topStudentsBody) {
        return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
        refs.topStudentsBody.innerHTML = `<tr><td colspan="6" class="school-analytics-empty-cell">No report records are available for the selected classes yet.</td></tr>`;
        return;
    }

    refs.topStudentsBody.innerHTML = rows.map((row) => `
        <tr>
            <td>${escapeHtml(String(row.rank))}</td>
            <td>${escapeHtml(row.studentName)}</td>
            <td>${escapeHtml(row.className)}</td>
            <td>${escapeHtml(String(row.totalMarks))}</td>
            <td>${escapeHtml(`${row.percentage.toFixed(1)}%`)}</td>
            <td>${escapeHtml(row.position)}</td>
        </tr>
    `).join("");
}

function getHardestSubject(modulePerformance) {
    const modulesWithMarks = (Array.isArray(modulePerformance) ? modulePerformance : []).filter((item) => item.detail !== "0 marks");
    if (modulesWithMarks.length === 0) {
        return null;
    }

    return [...modulesWithMarks].sort((left, right) => left.value - right.value)[0];
}

function renderHardestSubject(hardestSubject) {
    if (!refs.hardestSubjectName || !refs.hardestSubjectCopy) {
        return;
    }

    if (!hardestSubject) {
        refs.hardestSubjectName.textContent = "No marks yet";
        refs.hardestSubjectCopy.textContent = "Hardest subject will appear after module marks are submitted.";
        return;
    }

    refs.hardestSubjectName.textContent = hardestSubject.label;
    refs.hardestSubjectCopy.textContent = `Lowest average: ${hardestSubject.value.toFixed(1)}%${hardestSubject.meta ? ` • ${hardestSubject.meta}` : ""}`;
}

function renderSelectionSummary(snapshot) {
    if (refs.selectionCount) {
        refs.selectionCount.textContent = `${state.selectedClassIds.length} classes selected`;
    }
    if (refs.selectionCopy) {
        refs.selectionCopy.textContent = snapshot.visibleClasses.length > 0
            ? `Analytics is currently using ${snapshot.visibleClasses.length} class groups. Tick or untick classes below to update charts and rankings.`
            : "No class is selected right now. Tick at least one class below to load analytics charts and rankings.";
    }
}

function renderAnalytics() {
    renderOverviewCards();
    renderClassFilters();

    const snapshot = buildAnalyticsSnapshot();
    const classPerformance = buildClassPerformance(snapshot);
    const modulePerformance = buildModulePerformance(snapshot);
    const topStudents = buildTopStudents(snapshot);
    const hardestSubject = getHardestSubject(modulePerformance);
    const studentPerformance = buildStudentPerformance(snapshot);
    const selectionLabel = buildSelectionLabel(snapshot.visibleClasses);

    state.analyticsView = {
        snapshot,
        classPerformance,
        modulePerformance,
        topStudents,
        hardestSubject,
        studentPerformance,
        selectionLabel
    };

    renderSelectionSummary(snapshot);
    renderBarChart(
        refs.classChart,
        classPerformance,
        "No class performance data is available for the selected classes yet."
    );
    renderBarChart(
        refs.moduleChart,
        modulePerformance,
        "No module performance data is available for the selected classes yet."
    );
    renderTopStudents(topStudents);
    renderHardestSubject(hardestSubject);
    setExportButtonsEnabled(true);
}

function buildExportPayload() {
    if (!state.analyticsView) {
        return null;
    }

    return {
        schoolName: `${state.context?.schoolName || "School Management"}`.trim(),
        generatedAt: new Date(),
        selectionLabel: state.analyticsView.selectionLabel,
        totals: {
            totalStudents: state.data.students.length,
            totalClasses: state.data.classes.length,
            totalTeachers: state.data.teachers.length,
            totalModules: state.data.modules.length
        },
        classPerformance: state.analyticsView.classPerformance,
        modulePerformance: state.analyticsView.modulePerformance,
        topStudents: state.analyticsView.topStudents,
        hardestSubject: state.analyticsView.hardestSubject,
        studentPerformance: state.analyticsView.studentPerformance
    };
}

function runAnalyticsExport(exportType) {
    const payload = buildExportPayload();
    if (!payload) {
        setStatus("Analytics export is not ready yet. Please wait for the dashboard to finish loading.", "error");
        return;
    }

    const isPdf = exportType === "pdf";
    setExportButtonsEnabled(false);
    setStatus(isPdf ? "Preparing analytics PDF download..." : "Preparing analytics CSV download...", "info");

    try {
        const fileName = isPdf
            ? generateAnalyticsResultsPdf(payload)
            : downloadAnalyticsResultsCsv(payload);
        setStatus(`${fileName} downloaded successfully.`, "success");
    } catch (error) {
        console.error("Analytics export failed:", error);
        setStatus(isPdf ? "Analytics PDF download failed." : "Analytics CSV download failed.", "error");
    } finally {
        setExportButtonsEnabled(true);
    }
}

async function persistSelectedClasses() {
    const payload = {
        analyticsClassIds: [...state.selectedClassIds]
    };

    if (state.schoolSettingId) {
        await updateDoc(doc(db, SCHOOL_SETTINGS_COLLECTION, state.schoolSettingId), {
            ...payload,
            updatedAt: serverTimestamp()
        });
        return;
    }

    const createdSettingRef = await addDoc(collection(db, SCHOOL_SETTINGS_COLLECTION), {
        schoolId: `${state.context?.schoolId || ""}`.trim(),
        schoolName: `${state.context?.schoolName || ""}`.trim(),
        accessCode: "",
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    state.schoolSettingId = createdSettingRef.id;
}

async function handleClassSelectionChange() {
    state.selectedClassIds = Array.from(refs.classFilters?.querySelectorAll('input[type="checkbox"]:checked') || [])
        .map((input) => `${input.value || ""}`.trim())
        .filter(Boolean);

    state.analyticsView = null;
    setExportButtonsEnabled(false);
    renderAnalytics();
    setStatus("Saving selected classes for analytics...", "info");

    try {
        await persistSelectedClasses();
        setStatus("Analytics classes updated successfully.", "success");
    } catch (error) {
        console.error("Analytics class selection save failed:", error);
        setStatus("Could not save the selected analytics classes.", "error");
    }
}

async function loadAnalyticsData() {
    const schoolId = `${state.context?.schoolId || ""}`.trim();
    if (!schoolId) {
        throw new Error("No school was linked to this DOS account.");
    }

    const [
        schoolSettingSnapshot,
        studentsSnapshot,
        classesSnapshot,
        teachersSnapshot,
        modulesSnapshot,
        marksSnapshot,
        reportsSnapshot
    ] = await Promise.all([
        getDocs(query(collection(db, SCHOOL_SETTINGS_COLLECTION), where("schoolId", "==", schoolId), limit(1))),
        getDocs(query(collection(db, "students"), where("schoolId", "==", schoolId))),
        getDocs(query(collection(db, "classes"), where("schoolId", "==", schoolId))),
        getDocs(query(collection(db, "users"), where("schoolId", "==", schoolId), where("role", "==", "teacher"))),
        getDocs(query(collection(db, "modules"), where("schoolId", "==", schoolId))),
        getDocs(query(collection(db, "marks"), where("schoolId", "==", schoolId))),
        getDocs(query(collection(db, "reports"), where("schoolId", "==", schoolId)))
    ]);

    state.data.schoolSettings = schoolSettingSnapshot.empty
        ? null
        : {
            id: schoolSettingSnapshot.docs[0].id,
            ...schoolSettingSnapshot.docs[0].data()
        };
    state.schoolSettingId = state.data.schoolSettings?.id || "";
    state.data.students = studentsSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));
    state.data.classes = classesSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));
    state.data.teachers = teachersSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));
    state.data.modules = modulesSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));
    state.data.marks = marksSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));
    state.data.reports = reportsSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));

    const hasSavedSelection = Array.isArray(state.data.schoolSettings?.analyticsClassIds);
    const savedSelection = hasSavedSelection
        ? state.data.schoolSettings.analyticsClassIds
            .map((value) => `${value || ""}`.trim())
            .filter((value) => state.data.classes.some((classItem) => classItem.id === value))
        : [];

    state.selectedClassIds = hasSavedSelection
        ? savedSelection
        : state.data.classes.map((classItem) => `${classItem.id || ""}`.trim()).filter(Boolean);
}

async function initializeAnalyticsPage() {
    collectRefs();
    await ensureSchoolPersistence();
    setExportButtonsEnabled(false);

    refs.signOutButton?.addEventListener("click", async () => {
        try {
            window.localStorage.removeItem(SCHOOL_ACCESS_SESSION_KEY);
            await signOut(auth);
        } catch (error) {
            console.error("Analytics sign-out failed:", error);
        } finally {
            goTo(REGISTER_PAGE);
        }
    });

    refs.downloadPdfButton?.addEventListener("click", () => {
        runAnalyticsExport("pdf");
    });
    refs.downloadCsvButton?.addEventListener("click", () => {
        runAnalyticsExport("csv");
    });

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            setStatus("No DOS session was found. Redirecting to School Management login...", "error");
            goTo(REGISTER_PAGE);
            return;
        }

        try {
            setStatus("Checking DOS analytics access...", "info");
            state.context = await resolveDosContext(user);

            if (!state.context?.schoolId) {
                setStatus("Only DOS accounts can access School Analytics.", "error");
                goTo(DASHBOARD_PAGE);
                return;
            }

            updateSessionUi();

            await withAppServiceLoading("Loading school analytics...", async () => {
                await loadAnalyticsData();
            });

            state.analyticsView = null;
            renderAnalytics();
            setStatus("School Analytics is ready.", "success");
        } catch (error) {
            console.error("School analytics failed:", error);
            setStatus(error?.message || "School Analytics could not be loaded right now.", "error");
        }
    });
}

window.addEventListener("DOMContentLoaded", () => {
    initializeAnalyticsPage().catch((error) => {
        console.error("School analytics page failed:", error);
        setStatus("School Analytics could not be loaded right now.", "error");
    });
});
