import { createPill, formatDisplayDate, joinMeta, withAppServiceLoading } from "./shared.js";

const MODULE_CATEGORIES = [
    { value: "complementary", label: "Complementary Modules" },
    { value: "general", label: "General Modules" },
    { value: "specific", label: "Specific Modules" }
];

function normalizeModuleCategory(value = "") {
    const normalizedValue = `${value ?? ""}`.trim().toLowerCase();

    if (normalizedValue.includes("compl")) {
        return "complementary";
    }
    if (normalizedValue.includes("spec")) {
        return "specific";
    }

    return "general";
}

function getModuleCategoryLabel(value = "") {
    return MODULE_CATEGORIES.find((item) => item.value === normalizeModuleCategory(value))?.label || "General Modules";
}

function createTeacherCard(teacher, onEditTeacher) {
    const article = document.createElement("article");
    article.className = "school-record";

    const head = document.createElement("div");
    head.className = "school-record-head";

    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "school-record-title";
    title.textContent = teacher.fullName || "Unnamed teacher";

    const meta = document.createElement("p");
    meta.className = "school-record-meta";
    meta.textContent = joinMeta([
        teacher.subject || teacher.moduleName,
        teacher.className,
        teacher.email,
        `Added ${formatDisplayDate(teacher.createdAt)}`
    ], "Teacher profile");

    copy.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "school-pill-row";
    pills.append(
        createPill(getModuleCategoryLabel(teacher.moduleCategory), "info"),
        createPill(teacher.title || "Normal", teacher.title === "Class Teacher" ? "success" : "default"),
        createPill(teacher.level || "Level pending", teacher.level ? "success" : "default")
    );

    head.append(copy, pills);

    const summary = document.createElement("p");
    summary.className = "school-record-summary";
    summary.textContent = joinMeta([
        teacher.trade && `Trade: ${teacher.trade}`,
        teacher.sector && `Sector: ${teacher.sector}`,
        teacher.className && `Class: ${teacher.className}`,
        teacher.subject && `Module: ${teacher.subject}`,
        teacher.email && `Email: ${teacher.email}`
    ], "Teacher records now carry module category, trade, level, and class-teacher status.");

    const actions = document.createElement("div");
    actions.className = "school-record-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "ghost-button school-record-action";
    editButton.textContent = "Edit teacher";
    editButton.addEventListener("click", () => {
        onEditTeacher(teacher);
    });

    actions.appendChild(editButton);
    article.append(head, summary, actions);
    return article;
}

export function createTeachersController({ schoolStore, panel, onStatusChange }) {
    let form = null;
    let list = null;
    let emptyState = null;
    let countValue = null;
    let nameInput = null;
    let subjectInput = null;
    let moduleCategorySelect = null;
    let tradeInput = null;
    let levelInput = null;
    let sectorInput = null;
    let classSelect = null;
    let titleSelect = null;
    let emailInput = null;
    let passwordInput = null;
    let submitButton = null;
    let cancelEditButton = null;
    let teachers = [];
    let classes = [];
    let schoolSettings = [];
    let users = [];
    let editingTeacherId = null;

    function renderShell() {
        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="school-panel-head">
                <div>
                    <p class="menu-section-kicker">Collection</p>
                    <h3 class="school-panel-title">Teachers</h3>
                    <p class="school-panel-copy">Add teachers with module category, trade, level, and class-teacher role so modules and reports can stay structured.</p>
                </div>
                <div class="school-panel-stat">
                    <span class="school-panel-stat-label">Total</span>
                    <strong id="teachers-count-value">0</strong>
                </div>
            </div>

            <form id="school-teacher-form" class="school-form-grid school-form-grid-entity">
                <input id="school-teacher-name" class="field-input" type="text" placeholder="Teacher full name" required>
                <input id="school-teacher-email" class="field-input" type="email" placeholder="Email address" required>
                <input id="school-teacher-password" class="field-input" type="text" placeholder="Password from DOS" required>
                <input id="school-teacher-subject" class="field-input" type="text" placeholder="Module / subject" required>
                <select id="school-teacher-category" class="field-input" aria-label="Module category" required>
                    <option value="general">General Modules</option>
                    <option value="complementary">Complementary Modules</option>
                    <option value="specific">Specific Modules</option>
                </select>
                <select id="school-teacher-class" class="field-input" aria-label="Assigned class">
                    <option value="">Select class</option>
                </select>
                <input id="school-teacher-trade" class="field-input" type="text" placeholder="Trade" required>
                <input id="school-teacher-level" class="field-input" type="text" placeholder="Level" required>
                <input id="school-teacher-sector" class="field-input" type="text" placeholder="Sector" required>
                <select id="school-teacher-title" class="field-input" aria-label="Teacher title" required>
                    <option value="Normal">Normal</option>
                    <option value="Class Teacher">Class Teacher</option>
                </select>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="school-teacher-submit-button" class="primary-button" type="submit">Add teacher</button>
                    <button id="school-teacher-cancel-edit" class="ghost-button" type="button" hidden>Cancel edit</button>
                </div>
            </form>

            <div class="school-records-wrap">
                <div id="teachers-empty-state" class="download-empty">No teachers have been added for this school yet.</div>
                <div id="teachers-record-list" class="school-record-list"></div>
            </div>
        `;

        form = panel.querySelector("#school-teacher-form");
        list = panel.querySelector("#teachers-record-list");
        emptyState = panel.querySelector("#teachers-empty-state");
        countValue = panel.querySelector("#teachers-count-value");
        nameInput = panel.querySelector("#school-teacher-name");
        subjectInput = panel.querySelector("#school-teacher-subject");
        moduleCategorySelect = panel.querySelector("#school-teacher-category");
        classSelect = panel.querySelector("#school-teacher-class");
        tradeInput = panel.querySelector("#school-teacher-trade");
        levelInput = panel.querySelector("#school-teacher-level");
        sectorInput = panel.querySelector("#school-teacher-sector");
        titleSelect = panel.querySelector("#school-teacher-title");
        emailInput = panel.querySelector("#school-teacher-email");
        passwordInput = panel.querySelector("#school-teacher-password");
        submitButton = panel.querySelector("#school-teacher-submit-button");
        cancelEditButton = panel.querySelector("#school-teacher-cancel-edit");

        form?.addEventListener("submit", handleSubmit);
        classSelect?.addEventListener("change", syncTeacherClassDetails);
        cancelEditButton?.addEventListener("click", resetTeacherForm);
        setFormMode();
    }

    function setFormMode(teacher = null) {
        const isEditing = Boolean(teacher);

        if (submitButton) {
            submitButton.textContent = isEditing ? "Update teacher" : "Add teacher";
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
        classSelect.innerHTML = `<option value="">Select class</option>`;

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

        syncTeacherClassDetails();
    }

    function syncTeacherClassDetails() {
        const classItem = classes.find((item) => item.id === `${classSelect?.value || ""}`.trim());
        if (!classItem) {
            return;
        }

        if (tradeInput && !tradeInput.value.trim()) {
            tradeInput.value = classItem.trade || "";
        }
        if (levelInput && !levelInput.value.trim()) {
            levelInput.value = classItem.level || "";
        }
        if (sectorInput && !sectorInput.value.trim()) {
            sectorInput.value = classItem.sector || "";
        }
    }

    function renderTeachers() {
        if (!list || !emptyState || !countValue) {
            return;
        }

        list.replaceChildren(...teachers.map((teacher) => createTeacherCard(teacher, populateFormFromTeacher)));
        emptyState.hidden = teachers.length > 0;
        countValue.textContent = String(teachers.length);
    }

    function populateFormFromTeacher(teacher) {
        editingTeacherId = teacher.id;
        setFormMode(teacher);

        if (nameInput) {
            nameInput.value = teacher.fullName || "";
        }
        if (emailInput) {
            emailInput.value = teacher.email || "";
        }
        if (passwordInput) {
            passwordInput.value = teacher.password || teacher.accessCode || "";
        }
        if (subjectInput) {
            subjectInput.value = teacher.subject || teacher.moduleName || "";
        }
        if (moduleCategorySelect) {
            moduleCategorySelect.value = normalizeModuleCategory(teacher.moduleCategory);
        }
        if (classSelect) {
            classSelect.value = classes.some((classItem) => classItem.id === teacher.classId) ? teacher.classId : "";
        }
        if (tradeInput) {
            tradeInput.value = teacher.trade || "";
        }
        if (levelInput) {
            levelInput.value = teacher.level || "";
        }
        if (sectorInput) {
            sectorInput.value = teacher.sector || "";
        }
        if (titleSelect) {
            titleSelect.value = teacher.title || "Normal";
        }

        syncTeacherClassDetails();
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        onStatusChange?.("Teacher profile loaded into the editor. Update the fields and save to apply changes.", "info");
    }

    function resetTeacherForm() {
        editingTeacherId = null;
        form?.reset();

        if (moduleCategorySelect) {
            moduleCategorySelect.value = "general";
        }
        if (titleSelect) {
            titleSelect.value = "Normal";
        }

        renderClassOptions();
        setFormMode();
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const fullName = `${nameInput?.value || ""}`.trim();
        const subject = `${subjectInput?.value || ""}`.trim();
        const moduleCategory = normalizeModuleCategory(moduleCategorySelect?.value);
        const classId = `${classSelect?.value || ""}`.trim();
        const trade = `${tradeInput?.value || ""}`.trim();
        const level = `${levelInput?.value || ""}`.trim();
        const sector = `${sectorInput?.value || ""}`.trim();
        const title = `${titleSelect?.value || ""}`.trim() || "Normal";
        const email = `${emailInput?.value || ""}`.trim().toLowerCase();
        const password = `${passwordInput?.value || ""}`.trim();
        const classItem = classes.find((item) => item.id === classId);
        const currentAccessCode = `${schoolSettings[0]?.accessCode || ""}`.trim();
        const currentSchoolName = `${schoolSettings[0]?.schoolName || window.__JBNH_CURRENT_SCHOOL_RESOLVED_NAME__ || ""}`.trim();
        const existingTeacher = teachers.find((teacher) => `${teacher.email || ""}`.trim().toLowerCase() === email && teacher.id !== editingTeacherId);
        const existingUser = users.find((user) => {
            if (`${user.role || ""}`.trim().toLowerCase() !== "teacher") {
                return false;
            }

            const userLinkedProfileId = `${user.linkedProfileId || ""}`.trim();
            return (editingTeacherId && userLinkedProfileId === editingTeacherId) || `${user.email || ""}`.trim().toLowerCase() === email;
        });

        if (!fullName || !subject || !email || !password || !trade || !level || !sector) {
            onStatusChange?.("Enter the teacher name, email, DOS password, module, category, trade, level, and sector before saving.", "error");
            return;
        }

        if (existingTeacher) {
            onStatusChange?.("A teacher with that email already exists in this school.", "error");
            return;
        }

        const teacherPayload = {
            fullName,
            subject,
            moduleName: subject,
            moduleCategory,
            classId,
            className: classItem?.className || "",
            trade,
            level,
            sector,
            title,
            email,
            password,
            accessCode: password,
            dosAccessCode: currentAccessCode,
            dosId: `${window.__JBNH_CURRENT_SCHOOL_PROFILE_ID__ || ""}`.trim()
        };
        const isEditing = Boolean(editingTeacherId);

        try {
            await withAppServiceLoading(isEditing ? "Updating teacher record..." : "Saving teacher record...", async () => {
                let teacherId = editingTeacherId;
                if (isEditing) {
                    await schoolStore.updateTeacher(editingTeacherId, teacherPayload);
                } else {
                    teacherId = await schoolStore.addTeacher(teacherPayload);
                }

                const userPayload = {
                    role: "teacher",
                    email,
                    name: fullName,
                    accessCode: password,
                    schoolName: currentSchoolName,
                    linkedProfileId: teacherId,
                    classId,
                    className: classItem?.className || "",
                    trade,
                    level,
                    sector
                };

                if (existingUser?.id) {
                    await schoolStore.updateUser(existingUser.id, userPayload);
                } else {
                    await schoolStore.addUser(userPayload);
                }
            });

            resetTeacherForm();
            onStatusChange?.(
                isEditing ? "Teacher profile updated successfully." : "Teacher saved with module category successfully.",
                "success"
            );
        } catch (error) {
            console.error("Teacher save failed:", error);
            onStatusChange?.(isEditing ? "Could not update the teacher record." : "Could not save the teacher record.", "error");
        }
    }

    return {
        init() {
            renderShell();
            const unsubscribeTeachers = schoolStore.subscribe("teachers", (items) => {
                teachers = items.map((teacher) => ({
                    ...teacher,
                    moduleCategory: normalizeModuleCategory(teacher.moduleCategory)
                }));
                renderTeachers();
            });
            const unsubscribeClasses = schoolStore.subscribe("classes", (items) => {
                classes = items;
                renderClassOptions();
            });
            const unsubscribeSettings = schoolStore.subscribe("schoolSettings", (items) => {
                schoolSettings = items;
            });
            const unsubscribeUsers = schoolStore.subscribe("users", (items) => {
                users = items;
            });

            return {
                destroy() {
                    unsubscribeTeachers();
                    unsubscribeClasses();
                    unsubscribeSettings();
                    unsubscribeUsers();
                }
            };
        }
    };
}
