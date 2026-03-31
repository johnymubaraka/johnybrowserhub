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
import { calculateSubjectMetrics } from "./report-card-pdf.js";
import {
    db,
    ensureSchoolPersistence,
    SCHOOL_ACCESS_SESSION_KEY
} from "./firebase-context.js";

const TEACHER_LOGIN_PAGE = "/school/register.html";
const BROWSER_PAGE = "/browser.html";
const DOWNLOADS_PAGE = "/downloads.html";
const SCHOOL_MANAGEMENT_PAGE = "/school/register.html";
const LOGIN_PAGE = "/index.html";

const refs = {
    status: null,
    teacherName: null,
    moduleName: null,
    moduleCategory: null,
    className: null,
    tradeLevel: null,
    termNumber: null,
    portalCopy: null,
    moduleSelect: null,
    termSelect: null,
    formativeButton: null,
    comprehensiveButton: null,
    addAssignmentButton: null,
    sendMarksButton: null,
    assignmentSummary: null,
    assignmentStack: null,
    exitButton: null,
    menuToggle: null,
    menuCloseButton: null,
    menuOverlay: null,
    menuPanel: null,
    browserButton: null,
    chatButton: null,
    downloadsButton: null,
    schoolManagementButton: null,
    mainLoginButton: null,
    navLinks: []
};

const state = {
    session: null,
    modules: [],
    students: [],
    activeAssessment: "formative",
    assignments: {
        formative: [],
        comprehensive: []
    },
    currentModuleMarksRecord: null,
    menuOpen: false
};

function setStatus(message, stateName = "info") {
    if (!refs.status) {
        return;
    }

    refs.status.textContent = message;
    refs.status.dataset.state = stateName;
}

function setPending(isPending) {
    [
        refs.moduleSelect,
        refs.termSelect,
        refs.formativeButton,
        refs.comprehensiveButton,
        refs.addAssignmentButton,
        refs.sendMarksButton
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

function setAppMenuOpen(isOpen) {
    state.menuOpen = Boolean(isOpen);

    refs.menuPanel?.classList.toggle("hidden", !state.menuOpen);
    refs.menuOverlay?.classList.toggle("hidden", !state.menuOpen);
    refs.menuPanel?.setAttribute("aria-hidden", String(!state.menuOpen));
    refs.menuToggle?.setAttribute("aria-expanded", String(state.menuOpen));
    document.body.style.overflow = state.menuOpen ? "hidden" : "";
}

function goToFeaturePage(page) {
    setAppMenuOpen(false);
    goTo(page);
}

function normalizeLoose(value = "") {
    return `${value || ""}`.trim().toLowerCase();
}

function toNumber(value) {
    const parsed = Number.parseFloat(`${value ?? ""}`.trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

function getOrdinalLabel(number) {
    const labels = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    return labels[number - 1] || `${number}th`;
}

function getSelectedModule() {
    return state.modules.find((item) => item.id === refs.moduleSelect?.value) || state.modules[0] || null;
}

function createBlankAssignmentSection(number, students) {
    return {
        assignmentNumber: number,
        rows: students.map((student) => ({
            studentId: student.id,
            studentName: student.fullName || "Unnamed student",
            maximumMarks: "",
            marksScored: "",
            percentage: ""
        }))
    };
}

function getActiveSections() {
    return state.assignments[state.activeAssessment];
}

function setActiveSections(sections) {
    state.assignments[state.activeAssessment] = sections;
}

function syncAssessmentButtons() {
    refs.formativeButton?.classList.toggle("is-active", state.activeAssessment === "formative");
    refs.comprehensiveButton?.classList.toggle("is-active", state.activeAssessment === "comprehensive");
}

function syncNavLinks(activeId = "") {
    refs.navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
    });
}

function updateOverview() {
    const selectedModule = getSelectedModule();
    const session = state.session || {};

    if (refs.teacherName) {
        refs.teacherName.textContent = session.teacherName || "Teacher";
    }
    if (refs.moduleName) {
        refs.moduleName.textContent = selectedModule?.moduleName || session.moduleName || "No module selected";
    }
    if (refs.moduleCategory) {
        refs.moduleCategory.textContent = selectedModule?.moduleCategory || session.moduleCategory || "general";
    }
    if (refs.className) {
        refs.className.textContent = session.className || "No class linked";
    }
    if (refs.tradeLevel) {
        refs.tradeLevel.textContent = [session.trade, session.level].filter(Boolean).join(" / ") || "Not linked";
    }
    if (refs.termNumber) {
        refs.termNumber.textContent = refs.termSelect?.value || "Term 1";
    }
    if (refs.portalCopy) {
        refs.portalCopy.textContent = `Teacher ${session.teacherName || "account"} is connected to ${session.className || "the selected class"} for ${selectedModule?.moduleName || session.moduleName || "the saved module"}. Create formative or comprehensive assignments, enter marks, and submit them directly to DOS.`;
    }
}

function updateAssignmentSummary() {
    const selectedModule = getSelectedModule();
    const summaryCopy = refs.assignmentSummary?.querySelector(".school-record-summary");
    if (!summaryCopy) {
        return;
    }

    summaryCopy.textContent = `Module: ${selectedModule?.moduleName || state.session?.moduleName || "Not selected"} | Category: ${selectedModule?.moduleCategory || state.session?.moduleCategory || "general"} | Term: ${refs.termSelect?.value || "Term 1"} | Assessment: ${state.activeAssessment === "formative" ? "Formative" : "Comprehensive"}`;
}

function renderModuleOptions() {
    if (!refs.moduleSelect) {
        return;
    }

    const currentValue = refs.moduleSelect.value || state.session?.moduleId || "";
    refs.moduleSelect.innerHTML = state.modules.length > 0
        ? state.modules.map((moduleItem) => `<option value="${moduleItem.id}">${moduleItem.moduleName}</option>`).join("")
        : `<option value="">No module assigned</option>`;

    if (state.modules.some((moduleItem) => moduleItem.id === currentValue)) {
        refs.moduleSelect.value = currentValue;
    }
}

function renderAssignmentSections() {
    if (!refs.assignmentStack) {
        return;
    }

    const sections = getActiveSections();
    if (!Array.isArray(sections) || sections.length === 0) {
        refs.assignmentStack.innerHTML = `<div class="school-empty-state">No assignment tables exist yet for this assessment. Use <strong>Create Assignment</strong> to open the first table.</div>`;
        return;
    }

    refs.assignmentStack.innerHTML = sections.map((section, sectionIndex) => `
        <article class="school-assignment-card" data-assignment-section="${sectionIndex}">
            <div class="school-assignment-card-header">
                <h3>${getOrdinalLabel(section.assignmentNumber)} ${state.activeAssessment === "formative" ? "Formative" : "Comprehensive"} Assignment</h3>
                <span class="school-access-copy">Assignment ${section.assignmentNumber}</span>
            </div>

            <div class="school-assignment-table-wrap">
                <table class="school-assignment-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Maximum Marks</th>
                            <th>Marks Scored</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${section.rows.map((row, rowIndex) => `
                            <tr data-assignment-row="${rowIndex}">
                                <td>
                                    <input type="text" value="${row.studentName}" readonly>
                                </td>
                                <td>
                                    <input data-field="maximumMarks" type="number" min="1" value="${row.maximumMarks}">
                                </td>
                                <td>
                                    <input data-field="marksScored" type="number" min="0" value="${row.marksScored}">
                                </td>
                                <td>
                                    <input data-field="percentage" type="text" value="${row.percentage}" readonly>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </article>
    `).join("");

    Array.from(refs.assignmentStack.querySelectorAll("[data-assignment-section]")).forEach((sectionElement) => {
        const sectionIndex = Number.parseInt(sectionElement.dataset.assignmentSection || "-1", 10);
        if (!Number.isInteger(sectionIndex) || sectionIndex < 0) {
            return;
        }

        sectionElement.querySelectorAll('input[data-field="maximumMarks"], input[data-field="marksScored"]').forEach((input) => {
            input.addEventListener("input", () => {
                const sectionsState = getActiveSections();
                const section = sectionsState[sectionIndex];
                if (!section) {
                    return;
                }

                Array.from(sectionElement.querySelectorAll("[data-assignment-row]")).forEach((rowElement) => {
                    const rowIndex = Number.parseInt(rowElement.dataset.assignmentRow || "-1", 10);
                    const row = section.rows[rowIndex];
                    if (!row) {
                        return;
                    }

                    row.maximumMarks = rowElement.querySelector('[data-field="maximumMarks"]')?.value || "";
                    row.marksScored = rowElement.querySelector('[data-field="marksScored"]')?.value || "";

                    const maxMarks = toNumber(row.maximumMarks);
                    const marksScored = toNumber(row.marksScored);
                    const percentage = maxMarks > 0 ? Math.round((marksScored / maxMarks) * 1000) / 10 : 0;
                    row.percentage = row.maximumMarks && row.marksScored ? `${percentage}` : "";

                    const percentageInput = rowElement.querySelector('[data-field="percentage"]');
                    if (percentageInput) {
                        percentageInput.value = row.percentage;
                    }
                });

                setActiveSections([...sectionsState]);
            });
        });
    });
}

function hydrateSectionsFromRecord(record, assessmentType) {
    const assignmentKey = assessmentType === "formative" ? "formativeAssignments" : "comprehensiveAssignments";
    const sectionMap = new Map();

    state.students.forEach((student) => {
        const savedStudentMark = Array.isArray(record?.studentMarks)
            ? record.studentMarks.find((mark) => mark.studentId === student.id)
            : null;
        const assignments = Array.isArray(savedStudentMark?.[assignmentKey]) ? savedStudentMark[assignmentKey] : [];

        assignments.forEach((assignment) => {
            const assignmentNumber = Number.parseInt(`${assignment.assignmentNumber || 0}`, 10) || 1;
            if (!sectionMap.has(assignmentNumber)) {
                sectionMap.set(assignmentNumber, createBlankAssignmentSection(assignmentNumber, state.students));
            }

            const section = sectionMap.get(assignmentNumber);
            const row = section.rows.find((item) => item.studentId === student.id);
            if (!row) {
                return;
            }

            row.maximumMarks = `${assignment.maximumMarks ?? ""}`;
            row.marksScored = `${assignment.marksScored ?? ""}`;
            row.percentage = `${assignment.percentage ?? ""}`;
        });
    });

    const sections = [...sectionMap.values()].sort((left, right) => left.assignmentNumber - right.assignmentNumber);
    return sections.length > 0 ? sections : [createBlankAssignmentSection(1, state.students)];
}

async function loadCurrentModuleMarksRecord() {
    const selectedModuleId = `${refs.moduleSelect?.value || ""}`.trim();
    const term = `${refs.termSelect?.value || ""}`.trim();
    const schoolId = `${state.session?.schoolId || ""}`.trim();

    if (!selectedModuleId || !term || !schoolId) {
        state.currentModuleMarksRecord = null;
        state.assignments.formative = [createBlankAssignmentSection(1, state.students)];
        state.assignments.comprehensive = [createBlankAssignmentSection(1, state.students)];
        renderAssignmentSections();
        return;
    }

    const snapshot = await getDocs(query(
        collection(db, "moduleMarks"),
        where("schoolId", "==", schoolId),
        where("moduleId", "==", selectedModuleId),
        where("term", "==", term),
        limit(1)
    ));

    state.currentModuleMarksRecord = snapshot.empty
        ? null
        : {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        };

    state.assignments.formative = hydrateSectionsFromRecord(state.currentModuleMarksRecord, "formative");
    state.assignments.comprehensive = hydrateSectionsFromRecord(state.currentModuleMarksRecord, "comprehensive");
    renderAssignmentSections();
}

async function loadTeacherWorkspace() {
    const session = state.session;
    if (!session?.schoolId || !session?.classId) {
        throw new Error("Teacher session details are incomplete. Open School Access again.");
    }

    const [modulesSnapshot, studentsSnapshot] = await Promise.all([
        getDocs(query(
            collection(db, "modules"),
            where("schoolId", "==", session.schoolId),
            where("classId", "==", session.classId),
            limit(40)
        )),
        getDocs(query(
            collection(db, "students"),
            where("schoolId", "==", session.schoolId),
            where("classId", "==", session.classId),
            limit(120)
        ))
    ]);

    state.modules = modulesSnapshot.docs
        .map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
        }))
        .filter((moduleItem) => {
            const teacherMatch = moduleItem.teacherId ? moduleItem.teacherId === session.teacherId : true;
            const moduleMatch = session.moduleId ? moduleItem.id === session.moduleId : true;
            return teacherMatch || moduleMatch;
        });

    if (state.modules.length === 0 && session.moduleId && session.moduleName) {
        state.modules = [{
            id: session.moduleId,
            moduleName: session.moduleName,
            moduleCategory: session.moduleCategory || "general",
            classId: session.classId,
            className: session.className,
            maximumMarks: 100
        }];
    }

    state.students = studentsSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
    }));

    if (state.students.length === 0) {
        throw new Error("This class has no students yet. Ask DOS to register students first.");
    }

    renderModuleOptions();
    updateOverview();
    updateAssignmentSummary();
    await loadCurrentModuleMarksRecord();
}

function collectRefs() {
    refs.status = document.getElementById("teacher-portal-status");
    refs.teacherName = document.getElementById("teacher-portal-teacher-name");
    refs.moduleName = document.getElementById("teacher-portal-module-name");
    refs.moduleCategory = document.getElementById("teacher-portal-module-category");
    refs.className = document.getElementById("teacher-portal-class-name");
    refs.tradeLevel = document.getElementById("teacher-portal-trade-level");
    refs.termNumber = document.getElementById("teacher-portal-term-number");
    refs.portalCopy = document.getElementById("teacher-portal-copy");
    refs.moduleSelect = document.getElementById("teacher-module-select");
    refs.termSelect = document.getElementById("teacher-term-select");
    refs.formativeButton = document.getElementById("teacher-formative-button");
    refs.comprehensiveButton = document.getElementById("teacher-comprehensive-button");
    refs.addAssignmentButton = document.getElementById("teacher-add-assignment");
    refs.sendMarksButton = document.getElementById("teacher-send-marks");
    refs.assignmentSummary = document.getElementById("teacher-assignment-summary");
    refs.assignmentStack = document.getElementById("teacher-assignment-stack");
    refs.exitButton = document.getElementById("teacher-portal-sign-out");
    refs.menuToggle = document.getElementById("teacher-app-menu-toggle");
    refs.menuCloseButton = document.getElementById("teacher-app-menu-close");
    refs.menuOverlay = document.getElementById("teacher-app-menu-overlay");
    refs.menuPanel = document.getElementById("teacher-app-menu");
    refs.browserButton = document.getElementById("teacher-open-browser");
    refs.chatButton = document.getElementById("teacher-open-ai-chat");
    refs.downloadsButton = document.getElementById("teacher-open-downloads");
    refs.schoolManagementButton = document.getElementById("teacher-open-school-management");
    refs.mainLoginButton = document.getElementById("teacher-open-main-login");
    refs.navLinks = Array.from(document.querySelectorAll(".school-role-link"));
}

function createAssignmentsByStudent(sections = []) {
    const assignmentsByStudent = new Map();

    sections.forEach((section) => {
        section.rows.forEach((row) => {
            const maximumMarks = toNumber(row.maximumMarks);
            const marksScored = toNumber(row.marksScored);
            if (!maximumMarks && !marksScored) {
                return;
            }

            const percentage = maximumMarks > 0 ? Math.round((marksScored / maximumMarks) * 1000) / 10 : 0;
            const existing = assignmentsByStudent.get(row.studentId) || [];
            existing.push({
                assignmentNumber: section.assignmentNumber,
                maximumMarks,
                marksScored,
                percentage
            });
            assignmentsByStudent.set(row.studentId, existing);
        });
    });

    return assignmentsByStudent;
}

async function upsertAssignmentRecord({ schoolId, moduleItem, term, assessmentType, section }) {
    const snapshot = await getDocs(query(
        collection(db, "assignments"),
        where("schoolId", "==", schoolId),
        where("moduleId", "==", moduleItem.id),
        where("term", "==", term),
        where("type", "==", assessmentType),
        where("assignmentNumber", "==", section.assignmentNumber),
        limit(1)
    ));

    const maxScore = Math.max(...section.rows.map((row) => toNumber(row.maximumMarks)), 0);
    const payload = {
        classId: moduleItem.classId || state.session.classId,
        className: moduleItem.className || state.session.className || "",
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName || "",
        moduleCategory: moduleItem.moduleCategory || state.session.moduleCategory || "general",
        teacherId: state.session.teacherId,
        teacherName: state.session.teacherName || "",
        dosId: state.session.dosId || "",
        type: assessmentType,
        term,
        assignmentNumber: section.assignmentNumber,
        maxScore
    };

    if (!snapshot.empty) {
        const assignmentDoc = snapshot.docs[0];
        await updateDoc(doc(db, "assignments", assignmentDoc.id), {
            ...payload,
            updatedAt: serverTimestamp()
        });
        return assignmentDoc.id;
    }

    return addDoc(collection(db, "assignments"), {
        schoolId,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }).then((documentRef) => documentRef.id);
}

async function upsertMarkRecord({ schoolId, moduleItem, term, assessmentType, assignmentId, section, row }) {
    const snapshot = await getDocs(query(
        collection(db, "marks"),
        where("schoolId", "==", schoolId),
        where("assignmentId", "==", assignmentId),
        where("studentId", "==", row.studentId),
        limit(1)
    ));

    const payload = {
        classId: moduleItem.classId || state.session.classId,
        className: moduleItem.className || state.session.className || "",
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName || "",
        moduleCategory: moduleItem.moduleCategory || state.session.moduleCategory || "general",
        term,
        assignmentId,
        assignmentNumber: section.assignmentNumber,
        assignmentType: assessmentType,
        type: assessmentType,
        studentId: row.studentId,
        studentName: row.studentName,
        score: toNumber(row.marksScored),
        maxScore: toNumber(row.maximumMarks),
        percentage: toNumber(row.percentage),
        submittedBy: state.session.teacherId,
        teacherId: state.session.teacherId,
        teacherName: state.session.teacherName || "",
        submittedTo: state.session.dosId || "",
        dosId: state.session.dosId || ""
    };

    if (!snapshot.empty) {
        const markDoc = snapshot.docs[0];
        await updateDoc(doc(db, "marks", markDoc.id), {
            ...payload,
            updatedAt: serverTimestamp()
        });
        return markDoc.id;
    }

    return addDoc(collection(db, "marks"), {
        schoolId,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }).then((documentRef) => documentRef.id);
}

async function upsertModuleMarksAggregate({ moduleItem, term, studentMarks }) {
    const payload = {
        schoolId: state.session.schoolId,
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName || state.session.moduleName || "",
        moduleCategory: moduleItem.moduleCategory || state.session.moduleCategory || "general",
        classId: state.session.classId,
        className: state.session.className || "",
        teacherId: state.session.teacherId,
        teacherName: state.session.teacherName || "",
        trade: state.session.trade || "",
        level: state.session.level || "",
        sector: state.session.sector || "",
        term,
        maximumMarks: Math.max(moduleItem.maximumMarks || 0, ...studentMarks.map((item) => toNumber(item.maxMarks))) || 100,
        source: "teacher-portal",
        studentMarks,
        updatedAt: serverTimestamp()
    };

    if (state.currentModuleMarksRecord?.id) {
        await updateDoc(doc(db, "moduleMarks", state.currentModuleMarksRecord.id), payload);
        return;
    }

    await addDoc(collection(db, "moduleMarks"), {
        ...payload,
        createdAt: serverTimestamp()
    });
}

async function handleSendMarks() {
    const selectedModule = getSelectedModule();
    const term = `${refs.termSelect?.value || ""}`.trim();
    if (!selectedModule || !term) {
        setStatus("Select the module and term before sending marks to DOS.", "error");
        return;
    }

    setPending(true);
    setStatus(`Submitting ${state.activeAssessment} assignments and marks to DOS...`, "info");

    try {
        const schoolId = `${state.session?.schoolId || ""}`.trim();
        const formativeAssignmentsByStudent = createAssignmentsByStudent(state.assignments.formative);
        const comprehensiveAssignmentsByStudent = createAssignmentsByStudent(state.assignments.comprehensive);

        const sectionsByType = [
            ["formative", state.assignments.formative],
            ["comprehensive", state.assignments.comprehensive]
        ];

        for (const [assessmentType, sections] of sectionsByType) {
            for (const section of sections) {
                const hasAnyMarks = section.rows.some((row) => toNumber(row.maximumMarks) > 0 || toNumber(row.marksScored) > 0);
                if (!hasAnyMarks) {
                    continue;
                }

                const assignmentId = await upsertAssignmentRecord({
                    schoolId,
                    moduleItem: selectedModule,
                    term,
                    assessmentType,
                    section
                });

                for (const row of section.rows) {
                    const maximumMarks = toNumber(row.maximumMarks);
                    const marksScored = toNumber(row.marksScored);
                    if (!maximumMarks && !marksScored) {
                        continue;
                    }

                    await upsertMarkRecord({
                        schoolId,
                        moduleItem: selectedModule,
                        term,
                        assessmentType,
                        assignmentId,
                        section,
                        row
                    });
                }
            }
        }

        const studentMarks = state.students.map((student) => {
            const formativeAssignments = formativeAssignmentsByStudent.get(student.id) || [];
            const comprehensiveAssignments = comprehensiveAssignmentsByStudent.get(student.id) || [];
            const formativeAssessment = formativeAssignments.reduce((sum, item) => sum + toNumber(item.marksScored), 0);
            const comprehensiveAssessment = comprehensiveAssignments.reduce((sum, item) => sum + toNumber(item.marksScored), 0);
            const formativeMax = formativeAssignments.reduce((sum, item) => sum + toNumber(item.maximumMarks), 0);
            const comprehensiveMax = comprehensiveAssignments.reduce((sum, item) => sum + toNumber(item.maximumMarks), 0);
            const resolvedMaxMarks = formativeMax + comprehensiveMax || selectedModule.maximumMarks || 100;

            if (!formativeAssignments.length && !comprehensiveAssignments.length) {
                return null;
            }

            const metrics = calculateSubjectMetrics({
                subjectName: selectedModule.moduleName || state.session?.moduleName || "Module",
                moduleType: selectedModule.moduleCategory || state.session?.moduleCategory || "general",
                eu: formativeAssessment,
                et: comprehensiveAssessment,
                maxMarks: resolvedMaxMarks
            });

            return {
                studentId: student.id,
                studentName: student.fullName || "Unnamed student",
                formativeAssignments,
                comprehensiveAssignments,
                formativeAssessment,
                comprehensiveAssessment,
                total: metrics.total,
                percentage: metrics.percentage,
                grade: metrics.grade,
                maxMarks: resolvedMaxMarks
            };
        }).filter(Boolean);

        if (studentMarks.length === 0) {
            throw new Error("Add at least one scored assignment before submitting marks.");
        }

        await upsertModuleMarksAggregate({
            moduleItem: selectedModule,
            term,
            studentMarks
        });

        await loadCurrentModuleMarksRecord();
        updateAssignmentSummary();
        setStatus(`${state.activeAssessment === "formative" ? "Formative" : "Comprehensive"} assignments and marks were sent to DOS successfully.`, "success");
    } catch (error) {
        console.error("Teacher marks send failed:", error);
        setStatus(error?.message || "Teacher marks could not be sent to DOS.", "error");
        window.alert(error?.message || "Teacher marks could not be sent to DOS.");
    } finally {
        setPending(false);
    }
}

function switchAssessment(nextAssessment) {
    state.activeAssessment = nextAssessment === "comprehensive" ? "comprehensive" : "formative";
    syncAssessmentButtons();
    updateAssignmentSummary();
    renderAssignmentSections();
}

function handleAddAssignment() {
    const sections = [...getActiveSections()];
    const nextNumber = sections.length + 1;
    sections.push(createBlankAssignmentSection(nextNumber, state.students));
    setActiveSections(sections);
    updateAssignmentSummary();
    renderAssignmentSections();
}

function restoreSession() {
    try {
        state.session = JSON.parse(window.localStorage.getItem(SCHOOL_ACCESS_SESSION_KEY) || "null");
    } catch (error) {
        console.warn("Teacher portal session restore failed:", error);
    }

    if (!state.session || state.session.mode !== "teacher") {
        throw new Error("No teacher access session was found. Open School Access again.");
    }
}

async function initializeTeacherPortal() {
    collectRefs();
    restoreSession();
    await ensureSchoolPersistence();

    refs.menuToggle?.addEventListener("click", () => {
        setAppMenuOpen(!state.menuOpen);
    });
    refs.menuCloseButton?.addEventListener("click", () => {
        setAppMenuOpen(false);
    });
    refs.menuOverlay?.addEventListener("click", () => {
        setAppMenuOpen(false);
    });
    refs.browserButton?.addEventListener("click", () => {
        goToFeaturePage(BROWSER_PAGE);
    });
    refs.chatButton?.addEventListener("click", () => {
        goToFeaturePage(BROWSER_PAGE);
    });
    refs.downloadsButton?.addEventListener("click", () => {
        goToFeaturePage(DOWNLOADS_PAGE);
    });
    refs.schoolManagementButton?.addEventListener("click", () => {
        goToFeaturePage(SCHOOL_MANAGEMENT_PAGE);
    });
    refs.mainLoginButton?.addEventListener("click", () => {
        goToFeaturePage(LOGIN_PAGE);
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && state.menuOpen) {
            setAppMenuOpen(false);
        }
    });

    refs.navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            syncNavLinks(link.getAttribute("href")?.slice(1) || "");
        });
    });

    refs.formativeButton?.addEventListener("click", () => switchAssessment("formative"));
    refs.comprehensiveButton?.addEventListener("click", () => switchAssessment("comprehensive"));
    refs.addAssignmentButton?.addEventListener("click", handleAddAssignment);
    refs.sendMarksButton?.addEventListener("click", handleSendMarks);
    refs.moduleSelect?.addEventListener("change", async () => {
        updateOverview();
        updateAssignmentSummary();
        await loadCurrentModuleMarksRecord();
    });
    refs.termSelect?.addEventListener("change", async () => {
        updateOverview();
        updateAssignmentSummary();
        await loadCurrentModuleMarksRecord();
    });
    refs.exitButton?.addEventListener("click", () => {
        setAppMenuOpen(false);
        window.localStorage.removeItem(SCHOOL_ACCESS_SESSION_KEY);
        goTo(TEACHER_LOGIN_PAGE);
    });

    try {
        setStatus("Loading your module, class, assignments, and student tables...", "info");
        await loadTeacherWorkspace();
        switchAssessment("formative");
        syncNavLinks("teacher-module-section");
        setStatus("Teacher portal is ready. Create assignments, enter marks, and submit them to DOS.", "success");
    } catch (error) {
        console.error("Teacher portal initialization failed:", error);
        setStatus(error?.message || "Teacher portal could not be loaded.", "error");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    initializeTeacherPortal().catch((error) => {
        console.error("Teacher portal failed:", error);
        setStatus("Teacher portal could not be loaded.", "error");
    });
});
