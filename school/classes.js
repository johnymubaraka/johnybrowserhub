import { createPill, formatDisplayDate, joinMeta, withAppServiceLoading } from "./shared.js";

function createClassCard(classItem, students, teachers) {
    const article = document.createElement("article");
    article.className = "school-record";

    const matchingStudents = students.filter((student) => student.classId && student.classId === classItem.id);
    const assignedTeacher = teachers.find((teacher) => teacher.id === classItem.teacherId);

    const head = document.createElement("div");
    head.className = "school-record-head";

    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "school-record-title";
    title.textContent = classItem.className || "Untitled class";

    const meta = document.createElement("p");
    meta.className = "school-record-meta";
    meta.textContent = joinMeta([
        classItem.trade && `Trade ${classItem.trade}`,
        classItem.section && `Section ${classItem.section}`,
        classItem.level,
        classItem.sector && `Sector ${classItem.sector}`,
        classItem.room && `Room ${classItem.room}`,
        `Created ${formatDisplayDate(classItem.createdAt)}`
    ], "Class record");

    copy.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "school-pill-row";
    pills.append(
        createPill(`${matchingStudents.length} students`, matchingStudents.length > 0 ? "success" : "default"),
        createPill(assignedTeacher?.fullName || classItem.teacherName || "Teacher not linked", "info")
    );

    head.append(copy, pills);

    const summary = document.createElement("p");
    summary.className = "school-record-summary";
    summary.textContent = joinMeta([
        classItem.description && `Focus: ${classItem.description}`,
        classItem.trade && `Trade: ${classItem.trade}`,
        classItem.sector && `Sector: ${classItem.sector}`,
        assignedTeacher?.subject && `Lead subject: ${assignedTeacher.subject}`
    ], "Use this class to group students and attach reports.");

    article.append(head, summary);
    return article;
}

export function createClassesController({ schoolStore, panel, onStatusChange }) {
    let form = null;
    let list = null;
    let emptyState = null;
    let countValue = null;
    let nameInput = null;
    let tradeInput = null;
    let levelInput = null;
    let sectorInput = null;
    let sectionInput = null;
    let roomInput = null;
    let descriptionInput = null;
    let teacherSelect = null;
    let classes = [];
    let students = [];
    let teachers = [];

    function renderShell() {
        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="school-panel-head">
                <div>
                    <p class="menu-section-kicker">Collection</p>
                    <h3 class="school-panel-title">Classes</h3>
                    <p class="school-panel-copy">Build class groups for your school dashboard and link teachers and students in real time.</p>
                </div>
                <div class="school-panel-stat">
                    <span class="school-panel-stat-label">Total</span>
                    <strong id="classes-count-value">0</strong>
                </div>
            </div>

            <form id="school-class-form" class="school-form-grid school-form-grid-entity">
                <input id="school-class-name" class="field-input" type="text" placeholder="Class name e.g. Senior 2" required>
                <input id="school-class-trade" class="field-input" type="text" placeholder="Trade e.g. Software Development" required>
                <input id="school-class-level" class="field-input" type="text" placeholder="Level e.g. O-Level" required>
                <input id="school-class-sector" class="field-input" type="text" placeholder="Sector" required>
                <input id="school-class-section" class="field-input" type="text" placeholder="Section">
                <input id="school-class-room" class="field-input" type="text" placeholder="Room">
                <select id="school-class-teacher" class="field-input" aria-label="Class teacher">
                    <option value="">Assign teacher later</option>
                </select>
                <input id="school-class-description" class="field-input" type="text" placeholder="Optional class focus">
                <button class="primary-button" type="submit">Add class</button>
            </form>

            <div class="school-records-wrap">
                <div id="classes-empty-state" class="download-empty">No classes have been created for this school yet.</div>
                <div id="classes-record-list" class="school-record-list"></div>
            </div>
        `;

        form = panel.querySelector("#school-class-form");
        list = panel.querySelector("#classes-record-list");
        emptyState = panel.querySelector("#classes-empty-state");
        countValue = panel.querySelector("#classes-count-value");
        nameInput = panel.querySelector("#school-class-name");
        tradeInput = panel.querySelector("#school-class-trade");
        levelInput = panel.querySelector("#school-class-level");
        sectorInput = panel.querySelector("#school-class-sector");
        sectionInput = panel.querySelector("#school-class-section");
        roomInput = panel.querySelector("#school-class-room");
        descriptionInput = panel.querySelector("#school-class-description");
        teacherSelect = panel.querySelector("#school-class-teacher");

        form?.addEventListener("submit", handleSubmit);
    }

    function renderTeacherOptions() {
        if (!teacherSelect) {
            return;
        }

        const currentValue = teacherSelect.value;
        teacherSelect.innerHTML = `<option value="">Assign teacher later</option>`;

        teachers.forEach((teacher) => {
            const option = document.createElement("option");
            option.value = teacher.id;
            option.textContent = teacher.fullName || "Unnamed teacher";
            teacherSelect.appendChild(option);
        });

        if (teachers.some((teacher) => teacher.id === currentValue)) {
            teacherSelect.value = currentValue;
        }
    }

    function renderClasses() {
        if (!list || !emptyState || !countValue) {
            return;
        }

        list.replaceChildren(...classes.map((classItem) => createClassCard(classItem, students, teachers)));
        emptyState.hidden = classes.length > 0;
        countValue.textContent = String(classes.length);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const className = `${nameInput?.value || ""}`.trim();
        const trade = `${tradeInput?.value || ""}`.trim();
        const level = `${levelInput?.value || ""}`.trim();
        const sector = `${sectorInput?.value || ""}`.trim();
        const section = `${sectionInput?.value || ""}`.trim();
        const room = `${roomInput?.value || ""}`.trim();
        const description = `${descriptionInput?.value || ""}`.trim();
        const teacherId = `${teacherSelect?.value || ""}`.trim();
        const teacher = teachers.find((item) => item.id === teacherId);

        if (!className || !trade || !level || !sector) {
            onStatusChange?.("Enter the class name, trade, level, and sector before saving.", "error");
            return;
        }

        try {
            await withAppServiceLoading("Saving class record...", () => schoolStore.addClass({
                className,
                trade,
                level,
                sector,
                section,
                room,
                description,
                teacherId,
                teacherName: teacher?.fullName || ""
            }));

            form?.reset();
            renderTeacherOptions();
            onStatusChange?.("Class saved to Firebase successfully.", "success");
        } catch (error) {
            console.error("Class save failed:", error);
            onStatusChange?.("Could not save the class record.", "error");
        }
    }

    return {
        init() {
            renderShell();
            const unsubscribeClasses = schoolStore.subscribe("classes", (items) => {
                classes = items;
                renderClasses();
            });
            const unsubscribeStudents = schoolStore.subscribe("students", (items) => {
                students = items;
                renderClasses();
            });
            const unsubscribeTeachers = schoolStore.subscribe("teachers", (items) => {
                teachers = items;
                renderTeacherOptions();
                renderClasses();
            });

            return {
                destroy() {
                    unsubscribeClasses();
                    unsubscribeStudents();
                    unsubscribeTeachers();
                }
            };
        }
    };
}
