import { createPill, formatDisplayDate, joinMeta, withAppServiceLoading } from "./shared.js";

function createStudentCard(student, onEditStudent) {
    const article = document.createElement("article");
    article.className = "school-record";

    const head = document.createElement("div");
    head.className = "school-record-head";

    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "school-record-title";
    title.textContent = student.fullName || "Unnamed student";

    const meta = document.createElement("p");
    meta.className = "school-record-meta";
    meta.textContent = joinMeta([
        (student.traineeCode || student.admissionNumber) && `Code ${student.traineeCode || student.admissionNumber}`,
        student.className,
        student.level,
        student.sector && `Sector ${student.sector}`,
        `Added ${formatDisplayDate(student.createdAt)}`
    ], "Student profile");

    copy.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "school-pill-row";
    pills.append(
        createPill(student.className || "No class assigned", "info"),
        createPill(student.level || "Level pending", student.level ? "success" : "default")
    );

    head.append(copy, pills);

    const summary = document.createElement("p");
    summary.className = "school-record-summary";
    summary.textContent = joinMeta([
        student.sector && `Sector: ${student.sector}`,
        student.trade && `Trade: ${student.trade}`,
        student.guardianName && `Guardian: ${student.guardianName}`
    ], "Keep trainee basics linked to the DOS class setup.");

    const actions = document.createElement("div");
    actions.className = "school-record-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "ghost-button school-record-action";
    editButton.textContent = "Edit student";
    editButton.addEventListener("click", () => {
        onEditStudent(student);
    });

    actions.appendChild(editButton);
    article.append(head, summary, actions);
    return article;
}

export function createStudentsController({ schoolStore, panel, onStatusChange }) {
    let form = null;
    let list = null;
    let emptyState = null;
    let countValue = null;
    let nameInput = null;
    let admissionInput = null;
    let classSelect = null;
    let filterClassSelect = null;
    let levelInput = null;
    let sectorInput = null;
    let guardianInput = null;
    let guardianPhoneInput = null;
    let submitButton = null;
    let cancelEditButton = null;
    let students = [];
    let classes = [];
    let editingStudentId = null;
    let editingStudentSnapshot = null;

    function renderShell() {
        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="school-panel-head">
                <div>
                    <p class="menu-section-kicker">Collection</p>
                    <h3 class="school-panel-title">Students</h3>
                    <p class="school-panel-copy">Add student records and review them live from the Firestore <code>students</code> collection.</p>
                </div>
                <div class="school-panel-stat">
                    <span class="school-panel-stat-label">Total</span>
                    <strong id="students-count-value">0</strong>
                </div>
            </div>

            <form id="school-student-form" class="school-form-grid school-form-grid-entity">
                <input id="school-student-name" class="field-input" type="text" placeholder="Student full name" required>
                <input id="school-student-admission" class="field-input" type="text" placeholder="Trainee code">
                <select id="school-student-class" class="field-input" aria-label="Student class">
                    <option value="">Assign class later</option>
                </select>
                <input id="school-student-level" class="field-input" type="text" placeholder="Level" readonly>
                <input id="school-student-sector" class="field-input" type="text" placeholder="Sector" readonly>
                <input id="school-student-guardian" class="field-input" type="text" placeholder="Guardian name">
                <input id="school-student-phone" class="field-input" type="text" placeholder="Guardian phone">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="school-student-submit-button" class="primary-button" type="submit">Add student</button>
                    <button id="school-student-cancel-edit" class="ghost-button" type="button" hidden>Cancel edit</button>
                </div>
            </form>

            <div class="school-marks-toolbar" style="margin-top: 18px;">
                <label class="school-marks-control">
                    <span class="field-label">Display students by class</span>
                    <select id="school-students-filter-class" class="field-input" aria-label="Filter students by class">
                        <option value="">All classes</option>
                    </select>
                </label>
            </div>

            <div class="school-records-wrap">
                <div id="students-empty-state" class="download-empty">No students have been added for this school yet.</div>
                <div id="students-record-list" class="school-record-list"></div>
            </div>
        `;

        form = panel.querySelector("#school-student-form");
        list = panel.querySelector("#students-record-list");
        emptyState = panel.querySelector("#students-empty-state");
        countValue = panel.querySelector("#students-count-value");
        nameInput = panel.querySelector("#school-student-name");
        admissionInput = panel.querySelector("#school-student-admission");
        classSelect = panel.querySelector("#school-student-class");
        filterClassSelect = panel.querySelector("#school-students-filter-class");
        levelInput = panel.querySelector("#school-student-level");
        sectorInput = panel.querySelector("#school-student-sector");
        guardianInput = panel.querySelector("#school-student-guardian");
        guardianPhoneInput = panel.querySelector("#school-student-phone");
        submitButton = panel.querySelector("#school-student-submit-button");
        cancelEditButton = panel.querySelector("#school-student-cancel-edit");

        form?.addEventListener("submit", handleSubmit);
        classSelect?.addEventListener("change", syncClassDetails);
        filterClassSelect?.addEventListener("change", renderStudents);
        cancelEditButton?.addEventListener("click", resetStudentForm);
        setFormMode();
    }

    function setFormMode(student = null) {
        const isEditing = Boolean(student);

        if (submitButton) {
            submitButton.textContent = isEditing ? "Update student" : "Add student";
        }

        if (cancelEditButton) {
            cancelEditButton.hidden = !isEditing;
        }
    }

    function renderClassOptions() {
        if (!classSelect) {
            return;
        }

        const currentValue = classSelect.value;
        classSelect.innerHTML = `<option value="">Assign class later</option>`;

        classes.forEach((classItem) => {
            const option = document.createElement("option");
            option.value = classItem.id;
            option.textContent = [
                classItem.className || "Unnamed class",
                classItem.trade,
                classItem.level,
                classItem.sector
            ].filter(Boolean).join(" • ");
            classSelect.appendChild(option);
        });

        if (classes.some((classItem) => classItem.id === currentValue)) {
            classSelect.value = currentValue;
        }

        if (filterClassSelect) {
            const currentFilterValue = filterClassSelect.value;
            filterClassSelect.innerHTML = `<option value="">All classes</option>`;

            classes.forEach((classItem) => {
                const option = document.createElement("option");
                option.value = classItem.id;
                option.textContent = [
                    classItem.className || "Unnamed class",
                    classItem.trade,
                    classItem.level
                ].filter(Boolean).join(" • ");
                filterClassSelect.appendChild(option);
            });

            if (classes.some((classItem) => classItem.id === currentFilterValue)) {
                filterClassSelect.value = currentFilterValue;
            }
        }

        syncClassDetails();
    }

    function syncClassDetails() {
        const classItem = classes.find((item) => item.id === `${classSelect?.value || ""}`.trim());

        if (levelInput) {
            levelInput.value = classItem?.level || editingStudentSnapshot?.level || "";
        }

        if (sectorInput) {
            sectorInput.value = classItem?.sector || editingStudentSnapshot?.sector || "";
        }
    }

    function renderStudents() {
        if (!list || !emptyState || !countValue) {
            return;
        }

        const selectedClassId = `${filterClassSelect?.value || ""}`.trim();
        const visibleStudents = selectedClassId
            ? students.filter((student) => student.classId === selectedClassId)
            : students;

        list.replaceChildren(...visibleStudents.map((student) => createStudentCard(student, populateFormFromStudent)));
        emptyState.hidden = visibleStudents.length > 0;
        countValue.textContent = String(visibleStudents.length);
    }

    function populateFormFromStudent(student) {
        editingStudentId = student.id;
        editingStudentSnapshot = student;
        setFormMode(student);

        if (nameInput) {
            nameInput.value = student.fullName || "";
        }
        if (admissionInput) {
            admissionInput.value = student.admissionNumber || student.traineeCode || "";
        }
        if (classSelect) {
            classSelect.value = classes.some((classItem) => classItem.id === student.classId) ? student.classId : "";
        }
        if (guardianInput) {
            guardianInput.value = student.guardianName || "";
        }
        if (guardianPhoneInput) {
            guardianPhoneInput.value = student.guardianPhone || "";
        }

        syncClassDetails();
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        onStatusChange?.("Student profile loaded into the editor. Update the fields and save to apply changes.", "info");
    }

    function resetStudentForm() {
        editingStudentId = null;
        editingStudentSnapshot = null;
        form?.reset();
        renderClassOptions();
        setFormMode();
        syncClassDetails();
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const fullName = `${nameInput?.value || ""}`.trim();
        const admissionNumber = `${admissionInput?.value || ""}`.trim();
        const classId = `${classSelect?.value || ""}`.trim();
        const level = `${levelInput?.value || ""}`.trim();
        const sector = `${sectorInput?.value || ""}`.trim();
        const guardianName = `${guardianInput?.value || ""}`.trim();
        const guardianPhone = `${guardianPhoneInput?.value || ""}`.trim();
        const classItem = classes.find((item) => item.id === classId);

        if (!fullName) {
            onStatusChange?.("Enter the student name before saving.", "error");
            return;
        }

        const payload = {
            fullName,
            admissionNumber,
            traineeCode: admissionNumber,
            classId,
            className: classItem?.className || "",
            level: level || classItem?.level || editingStudentSnapshot?.level || "",
            sector: sector || classItem?.sector || editingStudentSnapshot?.sector || "",
            trade: classItem?.trade || editingStudentSnapshot?.trade || "",
            guardianName,
            guardianPhone
        };
        const isEditing = Boolean(editingStudentId);

        try {
            await withAppServiceLoading(
                isEditing ? "Updating student record..." : "Saving student record...",
                () => isEditing
                    ? schoolStore.updateStudent(editingStudentId, payload)
                    : schoolStore.addStudent(payload)
            );

            resetStudentForm();
            onStatusChange?.(
                isEditing ? "Student profile updated successfully." : "Student saved to Firebase successfully.",
                "success"
            );
        } catch (error) {
            console.error("Student save failed:", error);
            onStatusChange?.(isEditing ? "Could not update the student record." : "Could not save the student record.", "error");
        }
    }

    return {
        init() {
            renderShell();
            const unsubscribeStudents = schoolStore.subscribe("students", (items) => {
                students = items;
                renderStudents();
            });
            const unsubscribeClasses = schoolStore.subscribe("classes", (items) => {
                classes = items;
                renderClassOptions();
            });

            return {
                destroy() {
                    unsubscribeStudents();
                    unsubscribeClasses();
                }
            };
        }
    };
}
