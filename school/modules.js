import { createPill, formatDisplayDate, joinMeta, withAppServiceLoading } from "./shared.js";

const MODULE_CATEGORIES = [
    { value: "complementary", label: "Complementary Modules" },
    { value: "general", label: "General Modules" },
    { value: "specific", label: "Specific Modules" }
];

const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3", "Annual"];

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

function normalizeLoose(value = "") {
    return `${value || ""}`.trim().toLowerCase();
}

function createModuleCard(moduleItem, matchingMarksCount = 0, onViewMarks) {
    const article = document.createElement("article");
    article.className = "school-record";

    const head = document.createElement("div");
    head.className = "school-record-head";

    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "school-record-title";
    title.textContent = moduleItem.moduleName || "Untitled module";

    const meta = document.createElement("p");
    meta.className = "school-record-meta";
    meta.textContent = joinMeta([
        moduleItem.className,
        moduleItem.teacherName,
        moduleItem.term,
        `Added ${formatDisplayDate(moduleItem.createdAt)}`
    ], "School module");

    copy.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "school-pill-row";
    pills.append(
        createPill(getModuleCategoryLabel(moduleItem.moduleCategory), "info"),
        createPill(moduleItem.trade || "Trade pending", moduleItem.trade ? "success" : "default"),
        createPill(`${matchingMarksCount} marks`, matchingMarksCount > 0 ? "success" : "default")
    );

    head.append(copy, pills);

    const summary = document.createElement("p");
    summary.className = "school-record-summary";
    summary.textContent = joinMeta([
        moduleItem.level && `Level: ${moduleItem.level}`,
        moduleItem.maximumMarks && `Max score: ${moduleItem.maximumMarks}`,
        moduleItem.className && `Class: ${moduleItem.className}`
    ], "Assign the module to a class and teacher, then monitor live marks submissions below.");

    const actions = document.createElement("div");
    actions.className = "school-record-actions";

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "ghost-button school-record-action";
    viewButton.textContent = "View marks";
    viewButton.addEventListener("click", () => {
        onViewMarks(moduleItem);
    });

    actions.appendChild(viewButton);

    article.append(head, summary, actions);
    return article;
}

function buildMarksTableRows({
    marks = [],
    students = [],
    modules = [],
    teachers = []
}) {
    return marks.map((mark) => {
        const student = students.find((item) => item.id === mark.studentId);
        const moduleItem = modules.find((item) => item.id === mark.moduleId);
        const teacher = teachers.find((item) => item.id === mark.submittedBy || item.id === mark.teacherId);

        return {
            ...mark,
            studentName: mark.studentName || student?.fullName || "Unnamed student",
            moduleName: mark.moduleName || moduleItem?.moduleName || "Module",
            moduleCategory: mark.moduleCategory || moduleItem?.moduleCategory || "general",
            teacherName: mark.teacherName || teacher?.fullName || "Teacher"
        };
    });
}

function createMarksRowMarkup(mark) {
    return `
        <tr>
            <td>${mark.studentName}</td>
            <td>${mark.moduleName}</td>
            <td>${getModuleCategoryLabel(mark.moduleCategory)}</td>
            <td>${mark.assignmentNumber || "-"}</td>
            <td>${mark.assignmentType || mark.type || "-"}</td>
            <td>${mark.term || "-"}</td>
            <td>${mark.score ?? "-"}</td>
            <td>${mark.maxScore ?? mark.maximumMarks ?? "-"}</td>
            <td>${mark.percentage ?? "-"}</td>
            <td>${mark.teacherName}</td>
        </tr>
    `;
}

export function createModulesController({ schoolStore, panel, onStatusChange }) {
    let moduleForm = null;
    let modulesList = null;
    let emptyState = null;
    let moduleNameInput = null;
    let moduleCategorySelect = null;
    let moduleTeacherSelect = null;
    let moduleClassSelect = null;
    let moduleTradeInput = null;
    let moduleLevelInput = null;
    let moduleMaxMarksInput = null;
    let monitorClassSelect = null;
    let monitorModuleSelect = null;
    let monitorTermSelect = null;
    let monitorTableWrap = null;
    let monitorSummary = null;
    let modules = [];
    let teachers = [];
    let classes = [];
    let students = [];
    let marks = [];
    let assignments = [];

    function renderShell() {
        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="school-panel-head">
                <div>
                    <p class="menu-section-kicker">Collection</p>
                    <h3 class="school-panel-title">Modules & Marks Monitoring</h3>
                    <p class="school-panel-copy">Create modules, assign teachers, and monitor submitted marks by class, module, and term without changing the existing report-card form.</p>
                </div>
                <div class="school-panel-stat">
                    <span class="school-panel-stat-label">Modules</span>
                    <strong id="modules-count-value">0</strong>
                </div>
            </div>

            <form id="school-module-form" class="school-form-grid school-form-grid-entity">
                <input id="school-module-name" class="field-input" type="text" placeholder="Module name" required>
                <select id="school-module-category" class="field-input" aria-label="Module category" required>
                    <option value="general">General Modules</option>
                    <option value="complementary">Complementary Modules</option>
                    <option value="specific">Specific Modules</option>
                </select>
                <select id="school-module-class" class="field-input" aria-label="Module class" required>
                    <option value="">Select class</option>
                </select>
                <select id="school-module-teacher" class="field-input" aria-label="Assigned teacher" required>
                    <option value="">Assign teacher</option>
                </select>
                <input id="school-module-trade" class="field-input" type="text" placeholder="Trade">
                <input id="school-module-level" class="field-input" type="text" placeholder="Level">
                <input id="school-module-max-marks" class="field-input" type="number" min="1" value="100" placeholder="Maximum marks">
                <button class="primary-button" type="submit">Create module</button>
            </form>

            <section class="school-record" style="margin-top: 18px; padding: 18px;">
                <div class="school-panel-head" style="margin-bottom: 10px;">
                    <div>
                        <p class="menu-section-kicker">Marks Monitoring</p>
                        <h4 class="school-panel-title" style="font-size: 1rem;">Live teacher submissions</h4>
                        <p class="school-record-summary">Filter the live <code>marks</code> collection by class, module, and term to review the marks teachers have sent to DOS.</p>
                    </div>
                </div>

                <div class="school-marks-toolbar">
                    <label class="school-marks-control">
                        <span class="field-label">Class</span>
                        <select id="school-monitor-class" class="field-input" aria-label="Filter marks by class">
                            <option value="">All classes</option>
                        </select>
                    </label>
                    <label class="school-marks-control">
                        <span class="field-label">Module</span>
                        <select id="school-monitor-module" class="field-input" aria-label="Filter marks by module">
                            <option value="">All modules</option>
                        </select>
                    </label>
                    <label class="school-marks-control">
                        <span class="field-label">Term</span>
                        <select id="school-monitor-term" class="field-input" aria-label="Filter marks by term">
                            <option value="">All terms</option>
                            ${TERM_OPTIONS.map((termOption) => `<option value="${termOption}">${termOption}</option>`).join("")}
                        </select>
                    </label>
                </div>

                <div id="school-monitor-summary" class="school-record" style="margin-top: 16px; padding: 14px;">
                    <p class="school-record-summary">Class: All classes | Module: All modules | Term: All terms</p>
                </div>

                <div id="school-monitor-table-wrap" style="margin-top: 16px;"></div>
            </section>

            <div class="school-records-wrap">
                <div id="modules-empty-state" class="download-empty">No modules have been added for this school yet.</div>
                <div id="modules-record-list" class="school-record-list"></div>
            </div>
        `;

        moduleForm = panel.querySelector("#school-module-form");
        modulesList = panel.querySelector("#modules-record-list");
        emptyState = panel.querySelector("#modules-empty-state");
        moduleNameInput = panel.querySelector("#school-module-name");
        moduleCategorySelect = panel.querySelector("#school-module-category");
        moduleTeacherSelect = panel.querySelector("#school-module-teacher");
        moduleClassSelect = panel.querySelector("#school-module-class");
        moduleTradeInput = panel.querySelector("#school-module-trade");
        moduleLevelInput = panel.querySelector("#school-module-level");
        moduleMaxMarksInput = panel.querySelector("#school-module-max-marks");
        monitorClassSelect = panel.querySelector("#school-monitor-class");
        monitorModuleSelect = panel.querySelector("#school-monitor-module");
        monitorTermSelect = panel.querySelector("#school-monitor-term");
        monitorTableWrap = panel.querySelector("#school-monitor-table-wrap");
        monitorSummary = panel.querySelector("#school-monitor-summary");

        moduleForm?.addEventListener("submit", handleModuleSubmit);
        moduleTeacherSelect?.addEventListener("change", syncModuleDefaultsFromTeacher);
        monitorClassSelect?.addEventListener("change", renderMarksMonitor);
        monitorModuleSelect?.addEventListener("change", renderMarksMonitor);
        monitorTermSelect?.addEventListener("change", renderMarksMonitor);
    }

    function renderTeacherOptions() {
        if (!moduleTeacherSelect) {
            return;
        }

        const currentValue = moduleTeacherSelect.value;
        moduleTeacherSelect.innerHTML = `<option value="">Assign teacher</option>`;

        teachers.forEach((teacher) => {
            const option = document.createElement("option");
            option.value = teacher.id;
            option.textContent = teacher.fullName || "Unnamed teacher";
            moduleTeacherSelect.appendChild(option);
        });

        if (teachers.some((teacher) => teacher.id === currentValue)) {
            moduleTeacherSelect.value = currentValue;
        }
    }

    function renderClassOptions() {
        if (moduleClassSelect) {
            const currentModuleClass = moduleClassSelect.value;
            moduleClassSelect.innerHTML = `<option value="">Select class</option>`;

            classes.forEach((classItem) => {
                const option = document.createElement("option");
                option.value = classItem.id;
                option.textContent = classItem.className || "Unnamed class";
                moduleClassSelect.appendChild(option);
            });

            if (classes.some((classItem) => classItem.id === currentModuleClass)) {
                moduleClassSelect.value = currentModuleClass;
            }
        }

        if (monitorClassSelect) {
            const currentMonitorClass = monitorClassSelect.value;
            monitorClassSelect.innerHTML = `<option value="">All classes</option>`;

            classes.forEach((classItem) => {
                const option = document.createElement("option");
                option.value = classItem.id;
                option.textContent = classItem.className || "Unnamed class";
                monitorClassSelect.appendChild(option);
            });

            if (classes.some((classItem) => classItem.id === currentMonitorClass)) {
                monitorClassSelect.value = currentMonitorClass;
            }
        }
    }

    function renderMonitorModuleOptions() {
        if (!monitorModuleSelect) {
            return;
        }

        const currentValue = monitorModuleSelect.value;
        const selectedClassId = `${monitorClassSelect?.value || ""}`.trim();
        const visibleModules = selectedClassId
            ? modules.filter((moduleItem) => moduleItem.classId === selectedClassId)
            : modules;

        monitorModuleSelect.innerHTML = `<option value="">All modules</option>`;
        visibleModules.forEach((moduleItem) => {
            const option = document.createElement("option");
            option.value = moduleItem.id;
            option.textContent = `${moduleItem.moduleName || "Unnamed module"} • ${getModuleCategoryLabel(moduleItem.moduleCategory)}`;
            monitorModuleSelect.appendChild(option);
        });

        if (visibleModules.some((moduleItem) => moduleItem.id === currentValue)) {
            monitorModuleSelect.value = currentValue;
        }
    }

    function syncModuleDefaultsFromTeacher() {
        const teacher = teachers.find((item) => item.id === moduleTeacherSelect?.value);
        if (!teacher) {
            return;
        }

        if (moduleNameInput && !moduleNameInput.value.trim()) {
            moduleNameInput.value = teacher.subject || teacher.moduleName || "";
        }
        if (moduleTradeInput && !moduleTradeInput.value.trim()) {
            moduleTradeInput.value = teacher.trade || "";
        }
        if (moduleLevelInput && !moduleLevelInput.value.trim()) {
            moduleLevelInput.value = teacher.level || "";
        }
        if (moduleCategorySelect) {
            moduleCategorySelect.value = normalizeModuleCategory(teacher.moduleCategory);
        }
        if (moduleClassSelect && teacher.classId && classes.some((classItem) => classItem.id === teacher.classId)) {
            moduleClassSelect.value = teacher.classId;
        }
    }

    function renderMarksSummary(filteredMarks) {
        if (!monitorSummary) {
            return;
        }

        const classLabel = monitorClassSelect?.selectedOptions?.[0]?.textContent || "All classes";
        const moduleLabel = monitorModuleSelect?.selectedOptions?.[0]?.textContent || "All modules";
        const termLabel = monitorTermSelect?.value || "All terms";
        const summaryCopy = monitorSummary.querySelector(".school-record-summary");

        if (summaryCopy) {
            summaryCopy.textContent = `Class: ${classLabel} | Module: ${moduleLabel} | Term: ${termLabel} | Submitted marks: ${filteredMarks.length}`;
        }
    }

    function renderMarksMonitor() {
        renderMonitorModuleOptions();

        const selectedClassId = `${monitorClassSelect?.value || ""}`.trim();
        const selectedModuleId = `${monitorModuleSelect?.value || ""}`.trim();
        const selectedTerm = normalizeLoose(monitorTermSelect?.value || "");

        const filteredMarks = buildMarksTableRows({ marks, students, modules, teachers }).filter((mark) => {
            const classMatches = !selectedClassId || mark.classId === selectedClassId;
            const moduleMatches = !selectedModuleId || mark.moduleId === selectedModuleId;
            const termMatches = !selectedTerm || normalizeLoose(mark.term) === selectedTerm;
            return classMatches && moduleMatches && termMatches;
        });

        renderMarksSummary(filteredMarks);

        if (!monitorTableWrap) {
            return;
        }

        if (filteredMarks.length === 0) {
            monitorTableWrap.innerHTML = `<div class="download-empty">No submitted marks match the current filters yet.</div>`;
            return;
        }

        monitorTableWrap.innerHTML = `
            <div class="school-marks-table-wrap">
                <table class="school-marks-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Module</th>
                            <th>Category</th>
                            <th>Assignment</th>
                            <th>Type</th>
                            <th>Term</th>
                            <th>Score</th>
                            <th>Max</th>
                            <th>%</th>
                            <th>Submitted By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredMarks.map(createMarksRowMarkup).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderModules() {
        if (!modulesList || !emptyState) {
            return;
        }

        const countNode = panel?.querySelector("#modules-count-value");
        modulesList.replaceChildren(
            ...modules.map((moduleItem) => {
                const matchingMarksCount = marks.filter((mark) => mark.moduleId === moduleItem.id).length;
                return createModuleCard(moduleItem, matchingMarksCount, focusModuleMarks);
            })
        );
        emptyState.hidden = modules.length > 0;
        if (countNode) {
            countNode.textContent = String(modules.length);
        }
    }

    function focusModuleMarks(moduleItem) {
        if (moduleItem.classId && monitorClassSelect) {
            monitorClassSelect.value = moduleItem.classId;
        }
        renderMonitorModuleOptions();
        if (monitorModuleSelect) {
            monitorModuleSelect.value = moduleItem.id;
        }
        const recentTerm = assignments.find((assignment) => assignment.moduleId === moduleItem.id)?.term || "";
        if (monitorTermSelect && recentTerm) {
            if (!Array.from(monitorTermSelect.options).some((option) => option.value === recentTerm)) {
                const option = document.createElement("option");
                option.value = recentTerm;
                option.textContent = recentTerm;
                monitorTermSelect.appendChild(option);
            }
            monitorTermSelect.value = recentTerm;
        }

        renderMarksMonitor();
        monitorTableWrap?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function handleModuleSubmit(event) {
        event.preventDefault();

        const moduleName = `${moduleNameInput?.value || ""}`.trim();
        const moduleCategory = normalizeModuleCategory(moduleCategorySelect?.value);
        const classId = `${moduleClassSelect?.value || ""}`.trim();
        const teacherId = `${moduleTeacherSelect?.value || ""}`.trim();
        const trade = `${moduleTradeInput?.value || ""}`.trim();
        const level = `${moduleLevelInput?.value || ""}`.trim();
        const maximumMarks = Number.parseFloat(moduleMaxMarksInput?.value || "100");
        const classItem = classes.find((item) => item.id === classId);
        const teacher = teachers.find((item) => item.id === teacherId);

        if (!moduleName || !classItem || !teacher) {
            onStatusChange?.("Enter the module name, choose the class, and assign a teacher before saving.", "error");
            return;
        }

        try {
            await withAppServiceLoading("Saving school module...", () => schoolStore.addModule({
                moduleName,
                moduleCategory,
                classId: classItem.id,
                className: classItem.className || "",
                teacherId: teacher.id,
                teacherName: teacher.fullName || "",
                teacherEmail: teacher.email || "",
                trade: trade || teacher.trade || classItem.trade || "",
                level: level || teacher.level || classItem.level || "",
                sector: classItem.sector || teacher.sector || "",
                maximumMarks: Number.isFinite(maximumMarks) && maximumMarks > 0 ? maximumMarks : 100
            }));

            moduleForm?.reset();
            if (moduleCategorySelect) {
                moduleCategorySelect.value = "general";
            }
            renderTeacherOptions();
            renderClassOptions();
            onStatusChange?.("Module saved with its teacher assignment successfully.", "success");
        } catch (error) {
            console.error("Module save failed:", error);
            onStatusChange?.("Could not save the school module.", "error");
        }
    }

    return {
        init() {
            renderShell();

            const unsubscribeModules = schoolStore.subscribe("modules", (items) => {
                modules = items.map((item) => ({
                    ...item,
                    moduleCategory: normalizeModuleCategory(item.moduleCategory),
                    maximumMarks: Number.parseFloat(item.maximumMarks ?? 100) || 100
                }));
                renderModules();
                renderMonitorModuleOptions();
                renderMarksMonitor();
            });

            const unsubscribeTeachers = schoolStore.subscribe("teachers", (items) => {
                teachers = items;
                renderTeacherOptions();
                renderModules();
                renderMarksMonitor();
            });

            const unsubscribeClasses = schoolStore.subscribe("classes", (items) => {
                classes = items;
                renderClassOptions();
                renderModules();
                renderMarksMonitor();
            });

            const unsubscribeStudents = schoolStore.subscribe("students", (items) => {
                students = items;
                renderMarksMonitor();
            });

            const unsubscribeAssignments = schoolStore.subscribe("assignments", (items) => {
                assignments = items;
                renderMarksMonitor();
            });

            const unsubscribeMarks = schoolStore.subscribe("marks", (items) => {
                marks = items;
                renderModules();
                renderMarksMonitor();
            });

            return {
                destroy() {
                    unsubscribeModules();
                    unsubscribeTeachers();
                    unsubscribeClasses();
                    unsubscribeStudents();
                    unsubscribeAssignments();
                    unsubscribeMarks();
                }
            };
        }
    };
}
