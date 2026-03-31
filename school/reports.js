import {
    calculateReportSummary,
    calculateSubjectMetrics,
    generateReportCardPdf
} from "./report-card-pdf.js";
import { createPill, formatDisplayDate, joinMeta, withAppServiceLoading } from "./shared.js";

function toNumber(value) {
    const numericValue = Number.parseFloat(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function escapeAttribute(value) {
    return `${value ?? ""}`
        .replaceAll("&", "&amp;")
        .replaceAll("\"", "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

const DEFAULT_MODULE_SECTION = "general";
const MODULE_SECTIONS = [
    { key: "complementary", label: "Complementary Modules" },
    { key: "general", label: "General Modules" },
    { key: "specific", label: "Specific Modules" }
];

function normalizeModuleSection(value = "") {
    const normalizedValue = `${value ?? ""}`.trim().toLowerCase();

    if (normalizedValue.includes("compl")) {
        return "complementary";
    }
    if (normalizedValue.includes("spec")) {
        return "specific";
    }

    return DEFAULT_MODULE_SECTION;
}

function createModuleSectionsMarkup() {
    return MODULE_SECTIONS.map((section) => `
        <section class="school-record" style="margin-top: 14px; padding: 16px 16px 18px;">
            <div class="school-panel-head" style="margin-bottom: 8px;">
                <div>
                    <p class="menu-section-kicker">Module Section</p>
                    <h4 class="school-panel-title" style="font-size: 1rem;">${section.label}</h4>
                </div>
                <button class="ghost-button" type="button" data-action="add-module-subject" data-module-type="${section.key}">Add Subject</button>
            </div>
            <div data-subject-section-rows="${section.key}"></div>
        </section>
    `).join("");
}

function createDefaultReportHeader() {
    return {
        district: "",
        schoolName: "",
        email: "",
        rtbFull: "",
        contact: "",
        logoDataUrl: "",
        logoWidth: "112",
        logoLength: "64",
        secondaryLogoDataUrl: "",
        traineeName: "",
        traineeCode: "",
        className: "",
        academicYear: `${new Date().getFullYear()}`,
        sector: "",
        qualification: "",
        trade: "",
        level: ""
    };
}

function normalizeTemporaryReportHeader(reportHeader = {}, report = {}) {
    const defaults = createDefaultReportHeader();

    return {
        district: `${reportHeader.district ?? report.district ?? ""}`.trim(),
        schoolName: `${reportHeader.schoolName ?? report.schoolName ?? ""}`.trim(),
        email: `${reportHeader.email ?? report.email ?? ""}`.trim(),
        rtbFull: `${reportHeader.rtbFull ?? report.rtbFull ?? report.rtb ?? ""}`.trim(),
        contact: `${reportHeader.contact ?? report.contact ?? ""}`.trim(),
        logoDataUrl: `${reportHeader.logoDataUrl ?? reportHeader.schoolLogo ?? report.schoolLogo ?? ""}`.trim(),
        logoWidth: `${reportHeader.logoWidth ?? report.logoWidth ?? defaults.logoWidth}`.trim() || defaults.logoWidth,
        logoLength: `${reportHeader.logoLength ?? report.logoLength ?? report.logoHeight ?? defaults.logoLength}`.trim() || defaults.logoLength,
        secondaryLogoDataUrl: `${reportHeader.secondaryLogoDataUrl ?? reportHeader.altLogoDataUrl ?? report.altLogoDataUrl ?? ""}`.trim(),
        traineeName: `${reportHeader.traineeName ?? report.studentName ?? ""}`.trim(),
        traineeCode: `${reportHeader.traineeCode ?? report.admissionNumber ?? ""}`.trim(),
        className: `${reportHeader.className ?? report.className ?? ""}`.trim(),
        academicYear: `${reportHeader.academicYear ?? report.academicYear ?? defaults.academicYear}`.trim() || defaults.academicYear,
        sector: `${reportHeader.sector ?? report.sector ?? ""}`.trim(),
        qualification: `${reportHeader.qualification ?? report.qualification ?? report.qualificationTitle ?? ""}`.trim(),
        trade: `${reportHeader.trade ?? report.tradeSection ?? report.trade ?? ""}`.trim(),
        level: `${reportHeader.level ?? report.level ?? report.rtqfLevel ?? ""}`.trim()
    };
}

function normalizeLogoPreviewDimension(value, fallback) {
    const numericValue = Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(180, Math.max(40, Math.round(numericValue)));
}

function createDefaultMultiTermSummary() {
    return {
        term1: {
            label: "TERM 1",
            moduleWeight: "",
            formativeAssessment: "",
            integratedAssessment: "",
            comprehensiveAssessment: "",
            behavior: "",
            totalMarks: "",
            percentage: "",
            grade: ""
        },
        term2: {
            label: "TERM 2",
            moduleWeight: "",
            formativeAssessment: "",
            integratedAssessment: "",
            comprehensiveAssessment: "",
            behavior: "",
            totalMarks: "",
            percentage: "",
            grade: ""
        },
        term3: {
            label: "TERM 3",
            moduleWeight: "",
            formativeAssessment: "",
            integratedAssessment: "",
            comprehensiveAssessment: "",
            behavior: "",
            totalMarks: "",
            percentage: "",
            grade: ""
        },
        annual: {
            label: "ANNUAL",
            moduleWeight: "",
            formativeAssessment: "",
            integratedAssessment: "",
            comprehensiveAssessment: "",
            behavior: "",
            totalMarks: "",
            percentage: "",
            grade: ""
        }
    };
}

function sumSubjectMetric(subjectResults = [], fieldName) {
    return subjectResults.reduce((sum, subject) => sum + toNumber(subject?.[fieldName]), 0);
}

function normalizeTermMetrics(term = {}, defaults = {}) {
    const moduleWeight = `${term.moduleWeight ?? term.totalMarks ?? defaults.moduleWeight ?? ""}`.trim();
    const formativeAssessment = `${term.formativeAssessment ?? term.eu ?? defaults.formativeAssessment ?? ""}`.trim();
    const integratedAssessment = `${term.integratedAssessment ?? term.integrated ?? defaults.integratedAssessment ?? ""}`.trim();
    const comprehensiveAssessment = `${term.comprehensiveAssessment ?? term.et ?? defaults.comprehensiveAssessment ?? ""}`.trim();
    const behavior = `${term.behavior ?? defaults.behavior ?? ""}`.trim();
    const percentage = `${term.percentage ?? defaults.percentage ?? ""}`.trim();
    const grade = `${term.grade ?? defaults.grade ?? ""}`.trim();

    return {
        ...defaults,
        ...term,
        moduleWeight,
        formativeAssessment,
        integratedAssessment,
        comprehensiveAssessment,
        behavior,
        totalMarks: moduleWeight,
        percentage,
        grade
    };
}

function calculateAnnualMetrics(summary) {
    const annual = {
        ...summary.annual,
        label: "ANNUAL"
    };

    ["moduleWeight", "formativeAssessment", "integratedAssessment", "comprehensiveAssessment", "behavior"].forEach((fieldName) => {
        const total = ["term1", "term2", "term3"]
            .map((termKey) => toNumber(summary[termKey]?.[fieldName]))
            .reduce((sum, value) => sum + value, 0);

        annual[fieldName] = total > 0 ? `${Math.round(total * 10) / 10}` : "";
    });

    annual.totalMarks = annual.moduleWeight;

    const availablePercentages = ["term1", "term2", "term3"]
        .map((termKey) => toNumber(summary[termKey]?.percentage))
        .filter((value) => value > 0);
    const averagePercentage = availablePercentages.length > 0
        ? Math.round((availablePercentages.reduce((sum, value) => sum + value, 0) / availablePercentages.length) * 10) / 10
        : 0;

    annual.percentage = averagePercentage > 0 ? `${averagePercentage}` : "";
    annual.grade = averagePercentage > 0
        ? (averagePercentage >= 80 ? "A" : averagePercentage >= 75 ? "B" : averagePercentage >= 70 ? "C" : averagePercentage >= 65 ? "D" : averagePercentage >= 60 ? "E" : averagePercentage >= 50 ? "S" : "F")
        : "";

    return annual;
}

function normalizeTemporaryMultiTermSummary(multiTermSummary = {}, context = {}) {
    const defaults = createDefaultMultiTermSummary();
    const term1 = normalizeTermMetrics(multiTermSummary.term1, defaults.term1);
    const term2 = normalizeTermMetrics(multiTermSummary.term2, defaults.term2);
    const term3 = normalizeTermMetrics(multiTermSummary.term3, defaults.term3);
    const annualBase = normalizeTermMetrics(multiTermSummary.annual, defaults.annual);

    const next = {
        term1,
        term2,
        term3,
        annual: annualBase
    };

    next.annual = calculateAnnualMetrics(next);
    return next;
}

function createMultiTermMatrixMarkup(summary = {}) {
    const termOrder = [
        ["term1", "TERM 1"],
        ["term2", "TERM 2"],
        ["term3", "TERM 3"],
        ["annual", "ANNUAL"]
    ];
    const rowOrder = [
        ["moduleWeight", "Module Weight (Total Marks)"],
        ["formativeAssessment", "Formative Assessment (EU)"],
        ["integratedAssessment", "Integrated Assessment"],
        ["comprehensiveAssessment", "Comprehensive Assessment (ET)"],
        ["behavior", "Behavior"]
    ];

    const headerCells = termOrder.map(([termKey, label]) => `
        <div class="school-panel-stat" style="padding: 10px 12px; min-height: auto;">
            <span class="school-panel-stat-label">${termKey === "annual" ? "Auto" : "Term"}</span>
            <strong style="font-size: 0.98rem;">${label}</strong>
        </div>
    `).join("");

    const rows = rowOrder.map(([fieldName, label]) => `
        <div style="display: contents;">
            <div class="school-panel-stat" style="padding: 12px 14px; min-height: auto;">
                <span class="school-panel-stat-label">Metric</span>
                <strong style="font-size: 0.92rem; line-height: 1.35;">${label}</strong>
            </div>
            ${termOrder.map(([termKey]) => {
        const value = summary?.[termKey]?.[fieldName] ?? "";
        const readOnly = termKey === "annual" ? "readonly" : "";

        return `
                    <div>
                        <input data-term-key="${termKey}" data-summary-field="${fieldName}" class="field-input" type="text" value="${escapeAttribute(value)}" placeholder="${label}" ${readOnly}>
                    </div>
                `;
    }).join("")}
        </div>
    `).join("");

    return `
        <div id="school-report-multi-term-summary" style="display: grid; grid-template-columns: minmax(220px, 1.2fr) repeat(4, minmax(0, 1fr)); gap: 10px; align-items: stretch;">
            <div></div>
            ${headerCells}
            ${rows}
        </div>
    `;
}

function resolveTermSummaryKey(termValue) {
    const normalizedTerm = `${termValue ?? ""}`.trim().toLowerCase();

    if (!normalizedTerm) {
        return null;
    }
    if (normalizedTerm.includes("1") || normalizedTerm.includes("one")) {
        return "term1";
    }
    if (normalizedTerm.includes("2") || normalizedTerm.includes("two")) {
        return "term2";
    }
    if (normalizedTerm.includes("3") || normalizedTerm.includes("three")) {
        return "term3";
    }

    return null;
}

export function normalizeSubjectResult(subject = {}) {
    const normalizedSubject = calculateSubjectMetrics({
        subjectName: subject.subjectName || subject.subject || "Subject",
        eu: subject.eu ?? subject.score ?? 0,
        et: subject.et ?? 0,
        maxMarks: subject.maxMarks ?? subject.max ?? subject.weight ?? 100,
        total: subject.total,
        percentage: subject.percentage,
        grade: subject.grade
    });

    return {
        ...normalizedSubject,
        moduleType: normalizeModuleSection(subject.moduleType || subject.moduleSection || subject.module || subject.category)
    };
}

export function normalizeReportModel(report = {}) {
    const subjectResults = (Array.isArray(report.subjectResults) ? report.subjectResults : report.subjectScores || [])
        .map(normalizeSubjectResult);
    const summary = calculateReportSummary(subjectResults, report.position);
    const multiTermSummary = normalizeTemporaryMultiTermSummary(report.multiTermSummary, {
        term: report.term,
        summary,
        conductScore: report.conductScore || report.disciplineScore || "",
        subjectResults
    });
    const hasDetailedTermData = ["term1", "term2", "term3"].some((termKey) => {
        const termData = report.multiTermSummary?.[termKey];
        return Boolean(termData?.formativeAssessment || termData?.comprehensiveAssessment || termData?.moduleWeight);
    });
    const legacyNeedsUpdate = !report.reportHeader?.schoolName || !hasDetailedTermData;

    return {
        ...report,
        subjectResults,
        totalMarks: report.totalMarks ?? summary.totalMarks,
        maxMarks: report.maxMarks ?? report.maximumMarks ?? summary.maximumMarks,
        percentage: report.percentage ?? summary.percentage,
        finalGrade: report.finalGrade || report.overallGrade || summary.finalGrade,
        position: report.position || summary.position,
        conductScore: report.conductScore || report.disciplineScore || "N/A",
        behaviorRemarks: report.behaviorRemarks || report.remarks || "",
        teacherComments: report.teacherComments || report.summary || "",
        headTeacherComments: report.headTeacherComments || "",
        parentComments: report.parentComments || "",
        reportHeader: normalizeTemporaryReportHeader(report.reportHeader, report),
        multiTermSummary,
        legacyNeedsUpdate
    };
}

function normalizeTermLookupValue(value = "") {
    return `${value ?? ""}`.trim().toLowerCase();
}

function buildStoredModuleSubjectResults({ modules = [], moduleMarks = [], studentId = "", classId = "", term = "" }) {
    const normalizedTerm = normalizeTermLookupValue(term);
    if (!studentId || !classId || !normalizedTerm) {
        return [];
    }

    const subjectResults = moduleMarks
        .filter((item) => item.classId === classId && normalizeTermLookupValue(item.term) === normalizedTerm)
        .map((item) => {
            const studentMark = Array.isArray(item.studentMarks)
                ? item.studentMarks.find((mark) => mark.studentId === studentId)
                : null;

            if (!studentMark) {
                return null;
            }

            const linkedModule = modules.find((moduleItem) => moduleItem.id === item.moduleId);
            return normalizeSubjectResult({
                subjectName: item.moduleName || linkedModule?.moduleName || "Module",
                moduleType: item.moduleCategory || linkedModule?.moduleCategory || "general",
                eu: studentMark.formativeAssessment ?? studentMark.eu ?? 0,
                et: studentMark.comprehensiveAssessment ?? studentMark.et ?? 0,
                maxMarks: studentMark.maxMarks ?? item.maximumMarks ?? linkedModule?.maximumMarks ?? 100
            });
        })
        .filter(Boolean);

    return subjectResults.sort((left, right) => {
        const leftCategory = normalizeModuleSection(left.moduleType);
        const rightCategory = normalizeModuleSection(right.moduleType);
        if (leftCategory !== rightCategory) {
            return leftCategory.localeCompare(rightCategory);
        }

        return left.subjectName.localeCompare(right.subjectName);
    });
}

function buildStoredSubjectResultsFromMarks({ modules = [], marks = [], studentId = "", classId = "", term = "" }) {
    const normalizedTerm = normalizeTermLookupValue(term);
    if (!studentId || !classId || !normalizedTerm) {
        return [];
    }

    const groupedByModule = new Map();

    marks
        .filter((item) => item.studentId === studentId && item.classId === classId && normalizeTermLookupValue(item.term) === normalizedTerm)
        .forEach((item) => {
            const moduleId = `${item.moduleId || item.moduleName || ""}`.trim();
            if (!moduleId) {
                return;
            }

            const existing = groupedByModule.get(moduleId) || {
                subjectName: item.moduleName || "Module",
                moduleType: item.moduleCategory || "general",
                eu: 0,
                et: 0,
                maxMarks: 0
            };

            const score = toNumber(item.score);
            const maxScore = toNumber(item.maxScore || item.maximumMarks);
            if (normalizeTermLookupValue(item.assignmentType || item.type).includes("comp")) {
                existing.et += score;
            } else {
                existing.eu += score;
            }
            existing.maxMarks += maxScore;

            const linkedModule = modules.find((moduleItem) => moduleItem.id === item.moduleId);
            existing.subjectName = item.moduleName || linkedModule?.moduleName || existing.subjectName;
            existing.moduleType = item.moduleCategory || linkedModule?.moduleCategory || existing.moduleType;
            groupedByModule.set(moduleId, existing);
        });

    return [...groupedByModule.values()]
        .map((subject) => normalizeSubjectResult(subject))
        .sort((left, right) => {
            const leftCategory = normalizeModuleSection(left.moduleType);
            const rightCategory = normalizeModuleSection(right.moduleType);
            if (leftCategory !== rightCategory) {
                return leftCategory.localeCompare(rightCategory);
            }

            return left.subjectName.localeCompare(right.subjectName);
        });
}

function buildAutomaticPositionLabel({ reports = [], classId = "", term = "", editingReportId = null, percentage = 0 }) {
    const normalizedTerm = normalizeTermLookupValue(term);
    if (!classId || !normalizedTerm) {
        return "";
    }

    const rankedPercentages = reports
        .filter((report) => report.classId === classId && normalizeTermLookupValue(report.term) === normalizedTerm && report.id !== editingReportId)
        .map((report) => toNumber(report.percentage))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => right - left);

    const rank = 1 + rankedPercentages.filter((value) => value > percentage).length;
    const total = rankedPercentages.length + 1;
    return `${rank} out of ${total}`;
}

function createSummaryPill(label, value, tone = "default") {
    return createPill(`${label}: ${value}`, tone);
}

function createReportCard(report, onGeneratePdf, onRemakeReport) {
    const normalizedReport = normalizeReportModel(report);
    const article = document.createElement("article");
    article.className = "school-record";

    const head = document.createElement("div");
    head.className = "school-record-head";

    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "school-record-title";
    title.textContent = normalizedReport.title || "CAMIS Report Card";

    const meta = document.createElement("p");
    meta.className = "school-record-meta";
    meta.textContent = joinMeta([
        normalizedReport.studentName,
        normalizedReport.className,
        normalizedReport.term,
        `Saved ${formatDisplayDate(normalizedReport.createdAt)}`
    ], "Report card");

    copy.append(title, meta);

    const pills = document.createElement("div");
    pills.className = "school-pill-row";
    pills.append(
        createSummaryPill("Final Grade", normalizedReport.finalGrade, "success"),
        createSummaryPill("Percentage", `${normalizedReport.percentage}%`, "info"),
        createSummaryPill("Position", normalizedReport.position, "default")
    );
    if (normalizedReport.legacyNeedsUpdate) {
        pills.append(createPill("Needs Update", "warning"));
    }

    head.append(copy, pills);

    const summary = document.createElement("p");
    summary.className = "school-record-summary";
    summary.textContent = joinMeta([
        `Total ${normalizedReport.totalMarks}/${normalizedReport.maxMarks}`,
        `Conduct ${normalizedReport.conductScore}/40`,
        normalizedReport.teacherComments
    ], "CAMIS-style report summary");

    const subjectPreview = document.createElement("div");
    subjectPreview.className = "school-record-subjects";

    normalizedReport.subjectResults.slice(0, 6).forEach((subject) => {
        subjectPreview.appendChild(createPill(`${subject.subjectName}: ${subject.total} (${subject.grade})`));
    });

    const actions = document.createElement("div");
    actions.className = "school-record-actions";

    const pdfButton = document.createElement("button");
    pdfButton.type = "button";
    pdfButton.className = "ghost-button school-record-action";
    pdfButton.textContent = "Generate CAMIS PDF";
    pdfButton.addEventListener("click", () => {
        onGeneratePdf(normalizedReport);
    });

    const remakeButton = document.createElement("button");
    remakeButton.type = "button";
    remakeButton.className = "primary-button school-record-action";
    remakeButton.textContent = normalizedReport.legacyNeedsUpdate ? "Remake Report Card" : "Edit Report Card";
    remakeButton.addEventListener("click", () => {
        onRemakeReport(normalizedReport);
    });

    actions.append(pdfButton, remakeButton);

    article.append(head, summary);

    if (normalizedReport.subjectResults.length > 0) {
        article.appendChild(subjectPreview);
    }

    article.append(actions);
    return article;
}

function createSubjectRowMarkup(defaults = {}) {
    const subject = normalizeSubjectResult(defaults);

    return `
        <div class="school-record" data-subject-row data-module-type="${subject.moduleType}" style="margin-top: 12px; padding: 14px;">
            <div style="display: grid; grid-template-columns: minmax(0, 1.65fr) repeat(6, minmax(72px, 0.72fr)) auto; gap: 10px; align-items: end;">
                <div>
                    <label class="field-label">Subject Name</label>
                    <input data-field="subjectName" class="field-input" type="text" value="${escapeAttribute(subject.subjectName === "Subject" ? "" : subject.subjectName)}" placeholder="Subject name">
                </div>
                <div>
                    <label class="field-label">Weight</label>
                    <input data-field="maxMarks" class="field-input" type="number" min="1" value="${subject.maxMarks}">
                </div>
                <div>
                    <label class="field-label">EU</label>
                    <input data-field="eu" class="field-input" type="number" min="0" value="${subject.eu}">
                </div>
                <div>
                    <label class="field-label">ET</label>
                    <input data-field="et" class="field-input" type="number" min="0" value="${subject.et}">
                </div>
                <div>
                    <label class="field-label">TOT</label>
                    <input data-field="total" class="field-input" type="text" value="${subject.total}" readonly>
                </div>
                <div>
                    <label class="field-label">%</label>
                    <input data-field="percentage" class="field-input" type="text" value="${subject.percentage}" readonly>
                </div>
                <div>
                    <label class="field-label">Grade</label>
                    <input data-field="grade" class="field-input" type="text" value="${subject.grade}" readonly>
                </div>
                <div>
                    <button data-action="remove-subject" class="ghost-button" type="button">Remove</button>
                </div>
            </div>
        </div>
    `;
}

export function createReportsController({ schoolStore, panel, schoolName, onStatusChange }) {
    let form = null;
    let list = null;
    let emptyState = null;
    let countValue = null;
    let autoClassSelect = null;
    let autoTermSelect = null;
    let autoGenerateButton = null;
    let titleInput = null;
    let studentSelect = null;
    let classSelect = null;
    let teacherSelect = null;
    let districtInput = null;
    let schoolNameInput = null;
    let emailInput = null;
    let rtbFullInput = null;
    let contactInput = null;
    let logoInput = null;
    let logoPreview = null;
    let logoAddButton = null;
    let logoRemoveButton = null;
    let logoLengthInput = null;
    let logoWidthInput = null;
    let traineeNameInput = null;
    let traineeCodeInput = null;
    let headerClassInput = null;
    let headerAcademicYearInput = null;
    let sectorInput = null;
    let qualificationInput = null;
    let tradeInput = null;
    let levelInput = null;
    let termInput = null;
    let academicYearInput = null;
    let positionInput = null;
    let conductInput = null;
    let behaviorRemarksInput = null;
    let teacherCommentsInput = null;
    let headTeacherCommentsInput = null;
    let parentCommentsInput = null;
    let subjectSectionWraps = new Map();
    let totalMarksOutput = null;
    let maxMarksOutput = null;
    let percentageOutput = null;
    let finalGradeOutput = null;
    let multiTermSummaryWrap = null;
    let formModeLabel = null;
    let formModeCopy = null;
    let submitButton = null;
    let cancelEditButton = null;
    let reports = [];
    let students = [];
    let classes = [];
    let teachers = [];
    let modules = [];
    let moduleMarks = [];
    let marks = [];
    let assignments = [];
    let reportHeaderState = createDefaultReportHeader();
    let multiTermSummaryState = createDefaultMultiTermSummary();
    let editingReportId = null;
    let currentSchoolSetting = null;

    function getResolvedSchoolName(preferredValue = "") {
        const preferredSchoolName = `${preferredValue || ""}`.trim();
        if (preferredSchoolName) {
            return preferredSchoolName;
        }

        const schoolSettingName = `${currentSchoolSetting?.schoolName || ""}`.trim();
        if (schoolSettingName) {
            return schoolSettingName;
        }

        return `${schoolName || ""}`.trim() || "JohnyBrowserHub School Management";
    }

    function syncSchoolNameInput({ force = false } = {}) {
        if (!schoolNameInput) {
            return;
        }

        const isCustomized = schoolNameInput.dataset.userCustomized === "true";
        if (!force && (editingReportId || isCustomized)) {
            return;
        }

        schoolNameInput.value = getResolvedSchoolName();
        syncReportHeaderState();
    }

    function renderShell() {
        if (!panel) {
            return;
        }

        const headerDefaults = normalizeTemporaryReportHeader(reportHeaderState);
        const summaryDefaults = normalizeTemporaryMultiTermSummary(multiTermSummaryState);

        panel.innerHTML = `
            <div class="school-panel-head">
                <div>
                    <p class="menu-section-kicker">Collection</p>
                    <h3 id="school-report-form-mode" class="school-panel-title">Create Report Card</h3>
                    <p id="school-report-form-copy" class="school-panel-copy">Enter CAMIS-style marks with EU, ET, TOTAL, percentage, grade, and final report summary before generating the official PDF.</p>
                </div>
                <div class="school-panel-stat">
                    <span class="school-panel-stat-label">Total</span>
                    <strong id="reports-count-value">0</strong>
                </div>
            </div>

            <section class="school-record" style="margin-bottom: 18px; padding: 18px;">
                <div class="school-panel-head" style="margin-bottom: 10px;">
                    <div>
                        <p class="menu-section-kicker">DOS Report Generation</p>
                        <h4 class="school-panel-title" style="font-size: 1rem;">Generate report cards from submitted marks</h4>
                        <p class="school-record-summary">Choose the class and term, fetch marks from all assigned modules, calculate totals and rankings automatically, then store the generated results in the live <code>reports</code> collection.</p>
                    </div>
                </div>

                <div class="school-marks-toolbar">
                    <label class="school-marks-control">
                        <span class="field-label">Class</span>
                        <select id="school-report-auto-class" class="field-input" aria-label="Generate reports for class">
                            <option value="">Select class</option>
                        </select>
                    </label>
                    <label class="school-marks-control">
                        <span class="field-label">Term</span>
                        <select id="school-report-auto-term" class="field-input" aria-label="Generate reports for term">
                            <option value="Term 1">Term 1</option>
                            <option value="Term 2">Term 2</option>
                            <option value="Term 3">Term 3</option>
                            <option value="Annual">Annual</option>
                        </select>
                    </label>
                    <button id="school-report-auto-generate" class="primary-button" type="button">Generate Report Cards</button>
                </div>
            </section>

            <form id="school-report-form" class="school-form-grid school-form-grid-report">
                <section style="grid-column: 1 / -1; padding: 18px; border: 1px solid rgba(116, 201, 255, 0.22); border-radius: 26px; background: linear-gradient(145deg, rgba(10, 20, 44, 0.88), rgba(9, 35, 58, 0.72)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 42px rgba(0,0,0,0.22);">
                    <div style="display: grid; grid-template-columns: minmax(0, 1.12fr) 222px minmax(0, 1.16fr); gap: 16px; align-items: start;">
                        <div style="padding: 14px 16px; border-radius: 20px; border: 1px solid rgba(116, 201, 255, 0.16); background: rgba(3, 10, 26, 0.28);">
                            <p class="menu-section-kicker" style="margin-bottom: 10px;">Official Header</p>
                            <div style="display: grid; gap: 8px;">
                                <p style="margin: 0; font-size: 1rem; font-weight: 800; letter-spacing: 0.08em; color: #f5fbff;">REPUBLIC OF RWANDA</p>
                                <p style="margin: 0; font-size: 0.94rem; font-weight: 700; letter-spacing: 0.05em; color: rgba(225, 238, 255, 0.95);">MINISTRY OF EDUCATION</p>
                                <p style="margin: 0; font-size: 0.94rem; font-weight: 700; letter-spacing: 0.05em; color: rgba(147, 218, 255, 0.96);">RWANDA TVET BOARD</p>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px;">
                                <div>
                                    <label class="field-label" for="school-report-district">District</label>
                                    <input id="school-report-district" class="field-input" type="text" placeholder="District" value="${escapeAttribute(headerDefaults.district)}">
                                </div>
                                <div>
                                    <label class="field-label" for="school-report-school-name">School Name</label>
                                    <input id="school-report-school-name" class="field-input" type="text" placeholder="School name" value="${escapeAttribute(getResolvedSchoolName(headerDefaults.schoolName))}">
                                </div>
                                <div>
                                    <label class="field-label" for="school-report-email">Email</label>
                                    <input id="school-report-email" class="field-input" type="email" placeholder="School email" value="${escapeAttribute(headerDefaults.email)}">
                                </div>
                                <div>
                                    <label class="field-label" for="school-report-contact">Contact</label>
                                    <input id="school-report-contact" class="field-input" type="text" placeholder="School contact" value="${escapeAttribute(headerDefaults.contact)}">
                                </div>
                            </div>
                            <label class="field-label" for="school-report-rtb-full" style="margin-top: 12px;">RTB (Full)</label>
                            <input id="school-report-rtb-full" class="field-input" type="text" placeholder="Rwanda TVET Board full heading" value="${escapeAttribute(headerDefaults.rtbFull)}">
                        </div>

                        <div style="display: grid; gap: 12px; padding: 14px; border-radius: 20px; border: 1px solid rgba(116, 201, 255, 0.16); background: rgba(3, 10, 26, 0.28); justify-items: center;">
                            <p class="menu-section-kicker" style="margin-bottom: 0; text-align: center;">School Logo</p>
                            <div id="school-report-logo-preview" style="width: 118px; height: 118px; display: grid; place-items: center; border-radius: 28px; border: 1px dashed rgba(132, 214, 255, 0.36); background: radial-gradient(circle at top, rgba(72, 132, 255, 0.32), rgba(8, 18, 34, 0.9)); overflow: hidden;"></div>
                            <input id="school-report-logo" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                            <div style="display: flex; gap: 10px; width: 100%; justify-content: center; flex-wrap: wrap;">
                                <button id="school-report-logo-add" class="ghost-button" type="button">Add</button>
                                <button id="school-report-logo-remove" class="ghost-button" type="button">Remove</button>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%;">
                                <div>
                                    <label class="field-label" for="school-report-logo-length">Size: Length</label>
                                    <input id="school-report-logo-length" class="field-input" type="number" min="40" max="180" value="${escapeAttribute(headerDefaults.logoLength)}" placeholder="Length">
                                </div>
                                <div>
                                    <label class="field-label" for="school-report-logo-width">Size: Width</label>
                                    <input id="school-report-logo-width" class="field-input" type="number" min="40" max="180" value="${escapeAttribute(headerDefaults.logoWidth)}" placeholder="Width">
                                </div>
                            </div>
                        </div>

                        <div style="padding: 14px 16px; border-radius: 20px; border: 1px solid rgba(116, 201, 255, 0.16); background: rgba(3, 10, 26, 0.28);">
                            <p class="menu-section-kicker" style="margin-bottom: 10px;">Trainee Details</p>
                            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
                                <div>
                                    <label class="field-label" for="school-report-trainee-name">Trainee's Name</label>
                                    <input id="school-report-trainee-name" class="field-input" type="text" placeholder="Trainee name" value="${escapeAttribute(headerDefaults.traineeName)}">
                                </div>
                                <div>
                                    <label class="field-label" for="school-report-trainee-code">Trainee Code</label>
                                    <input id="school-report-trainee-code" class="field-input" type="text" placeholder="Trainee code" value="${escapeAttribute(headerDefaults.traineeCode)}">
                                </div>
                                <div>
                                    <label class="field-label" for="school-report-header-class">Class</label>
                                    <input id="school-report-header-class" class="field-input" type="text" placeholder="Class" value="${escapeAttribute(headerDefaults.className)}">
                                </div>
                                <div>
                                    <label class="field-label" for="school-report-header-academic-year">Academic Year</label>
                                    <input id="school-report-header-academic-year" class="field-input" type="text" placeholder="Academic year" value="${escapeAttribute(headerDefaults.academicYear)}">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 0.75fr); gap: 12px; margin-top: 16px;">
                        <div>
                            <label class="field-label" for="school-report-sector">Sector</label>
                            <input id="school-report-sector" class="field-input" type="text" placeholder="Sector" value="${escapeAttribute(headerDefaults.sector)}">
                        </div>
                        <div>
                            <label class="field-label" for="school-report-qualification">Qualification Title</label>
                            <input id="school-report-qualification" class="field-input" type="text" placeholder="Qualification title" value="${escapeAttribute(headerDefaults.qualification)}">
                        </div>
                        <div>
                            <label class="field-label" for="school-report-trade">Trade</label>
                            <input id="school-report-trade" class="field-input" type="text" placeholder="Trade" value="${escapeAttribute(headerDefaults.trade)}">
                        </div>
                        <div>
                            <label class="field-label" for="school-report-level">RTQF Level</label>
                            <input id="school-report-level" class="field-input" type="text" placeholder="RTQF level" value="${escapeAttribute(headerDefaults.level)}">
                        </div>
                    </div>
                </section>

                <select id="school-report-student" class="field-input" aria-label="Student" required>
                    <option value="">Select student</option>
                </select>
                <select id="school-report-class" class="field-input" aria-label="Class" required>
                    <option value="">Select class</option>
                </select>
                <select id="school-report-teacher" class="field-input" aria-label="Teacher">
                    <option value="">Assign teacher later</option>
                </select>
                <input id="school-report-term" class="field-input" type="text" placeholder="Term / semester" required>
                <input id="school-report-academic-year" class="field-input" type="text" placeholder="Academic year" value="${new Date().getFullYear()}">
                <input id="school-report-position" class="field-input" type="text" placeholder="Position e.g. 1 out of 43">
                <input id="school-report-conduct" class="field-input" type="number" min="0" max="40" placeholder="Conduct / 40">
                <textarea id="school-report-behavior" class="field-input school-textarea" rows="4" placeholder="Behavior / conduct remarks"></textarea>
                <textarea id="school-report-teacher-comments" class="field-input school-textarea" rows="4" placeholder="Teacher comments"></textarea>
                <textarea id="school-report-head-comments" class="field-input school-textarea" rows="4" placeholder="Head teacher comments"></textarea>
                <textarea id="school-report-parent-comments" class="field-input school-textarea is-full" rows="4" placeholder="Parent comments"></textarea>

                <div style="grid-column: 1 / -1; margin-top: 6px;">
                    <div class="school-panel-head">
                        <div>
                            <p class="menu-section-kicker">Subject Results</p>
                            <h4 class="school-panel-title" style="font-size: 1.05rem;">Classified modules with live CAMIS totals</h4>
                        </div>
                    </div>

                    <p class="school-form-help">Grades use the CAMIS scale: A 80-100, B 75-79, C 70-74, D 65-69, E 60-64, S 50-59, F 0-49.</p>
                    <div style="display: grid; gap: 4px;">
                        ${createModuleSectionsMarkup()}
                    </div>
                </div>

                <div style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 8px;">
                    <div class="school-panel-stat">
                        <span class="school-panel-stat-label">Total Marks</span>
                        <strong id="school-report-total-marks">0</strong>
                    </div>
                    <div class="school-panel-stat">
                        <span class="school-panel-stat-label">Maximum Marks</span>
                        <strong id="school-report-max-marks">0</strong>
                    </div>
                    <div class="school-panel-stat">
                        <span class="school-panel-stat-label">Percentage</span>
                        <strong id="school-report-percentage">0</strong>
                    </div>
                    <div class="school-panel-stat">
                        <span class="school-panel-stat-label">Final Grade</span>
                        <strong id="school-report-final-grade">F</strong>
                    </div>
                </div>

                <section style="grid-column: 1 / -1; margin-top: 8px;">
                    <div class="school-panel-head">
                        <div>
                            <p class="menu-section-kicker">Multi-Term Summary</p>
                            <h4 class="school-panel-title" style="font-size: 1.05rem;">TERM 1, TERM 2, TERM 3, and ANNUAL details</h4>
                        </div>
                    </div>
                    <p class="school-form-help">The active term auto-fills Module Weight, EU, ET, and Behavior from the report marks. Annual values are calculated automatically as the sum of Term 1, Term 2, and Term 3.</p>
                    ${createMultiTermMatrixMarkup(summaryDefaults)}
                </section>

                <div style="grid-column: 1 / -1; display: flex; gap: 12px; flex-wrap: wrap;">
                    <button id="school-report-submit-button" class="primary-button" type="submit">Save CAMIS report card</button>
                    <button id="school-report-cancel-edit" class="ghost-button" type="button" hidden>Cancel edit</button>
                </div>
            </form>

            <div class="school-records-wrap">
                <div id="reports-empty-state" class="download-empty">No report cards have been created for this school yet.</div>
                <div id="reports-record-list" class="school-record-list"></div>
            </div>
        `;

        form = panel.querySelector("#school-report-form");
        list = panel.querySelector("#reports-record-list");
        emptyState = panel.querySelector("#reports-empty-state");
        countValue = panel.querySelector("#reports-count-value");
        autoClassSelect = panel.querySelector("#school-report-auto-class");
        autoTermSelect = panel.querySelector("#school-report-auto-term");
        autoGenerateButton = panel.querySelector("#school-report-auto-generate");
        formModeLabel = panel.querySelector("#school-report-form-mode");
        formModeCopy = panel.querySelector("#school-report-form-copy");
        titleInput = panel.querySelector("#school-report-title");
        studentSelect = panel.querySelector("#school-report-student");
        classSelect = panel.querySelector("#school-report-class");
        teacherSelect = panel.querySelector("#school-report-teacher");
        districtInput = panel.querySelector("#school-report-district");
        schoolNameInput = panel.querySelector("#school-report-school-name");
        emailInput = panel.querySelector("#school-report-email");
        rtbFullInput = panel.querySelector("#school-report-rtb-full");
        contactInput = panel.querySelector("#school-report-contact");
        logoInput = panel.querySelector("#school-report-logo");
        logoPreview = panel.querySelector("#school-report-logo-preview");
        logoAddButton = panel.querySelector("#school-report-logo-add");
        logoRemoveButton = panel.querySelector("#school-report-logo-remove");
        logoLengthInput = panel.querySelector("#school-report-logo-length");
        logoWidthInput = panel.querySelector("#school-report-logo-width");
        traineeNameInput = panel.querySelector("#school-report-trainee-name");
        traineeCodeInput = panel.querySelector("#school-report-trainee-code");
        headerClassInput = panel.querySelector("#school-report-header-class");
        headerAcademicYearInput = panel.querySelector("#school-report-header-academic-year");
        sectorInput = panel.querySelector("#school-report-sector");
        qualificationInput = panel.querySelector("#school-report-qualification");
        tradeInput = panel.querySelector("#school-report-trade");
        levelInput = panel.querySelector("#school-report-level");
        termInput = panel.querySelector("#school-report-term");
        academicYearInput = panel.querySelector("#school-report-academic-year");
        positionInput = panel.querySelector("#school-report-position");
        conductInput = panel.querySelector("#school-report-conduct");
        behaviorRemarksInput = panel.querySelector("#school-report-behavior");
        teacherCommentsInput = panel.querySelector("#school-report-teacher-comments");
        headTeacherCommentsInput = panel.querySelector("#school-report-head-comments");
        parentCommentsInput = panel.querySelector("#school-report-parent-comments");
        subjectSectionWraps = new Map(
            MODULE_SECTIONS.map((section) => [section.key, panel.querySelector(`[data-subject-section-rows="${section.key}"]`)])
        );
        totalMarksOutput = panel.querySelector("#school-report-total-marks");
        maxMarksOutput = panel.querySelector("#school-report-max-marks");
        percentageOutput = panel.querySelector("#school-report-percentage");
        finalGradeOutput = panel.querySelector("#school-report-final-grade");
        multiTermSummaryWrap = panel.querySelector("#school-report-multi-term-summary");
        submitButton = panel.querySelector("#school-report-submit-button");
        cancelEditButton = panel.querySelector("#school-report-cancel-edit");

        form?.addEventListener("submit", handleSubmit);
        autoGenerateButton?.addEventListener("click", handleGenerateReports);
        studentSelect?.addEventListener("change", () => {
            syncClassFromStudent();
            syncSubjectRowsFromStoredModuleMarks();
        });
        classSelect?.addEventListener("change", () => {
            syncTeacherFromClass();
            syncSubjectRowsFromStoredModuleMarks();
        });
        autoClassSelect?.addEventListener("change", syncAutoReportDefaults);
        autoTermSelect?.addEventListener("change", syncAutoReportDefaults);
        panel.querySelectorAll('[data-action="add-module-subject"]').forEach((button) => {
            button.addEventListener("click", () => {
                addSubjectRow({ moduleType: button.dataset.moduleType || DEFAULT_MODULE_SECTION });
            });
        });
        logoInput?.addEventListener("change", handleLogoChange);
        logoAddButton?.addEventListener("click", () => {
            logoInput?.click();
        });
        logoRemoveButton?.addEventListener("click", removeLogo);
        logoLengthInput?.addEventListener("input", handleLogoSizeChange);
        logoWidthInput?.addEventListener("input", handleLogoSizeChange);
        [
            districtInput,
            emailInput,
            rtbFullInput,
            contactInput,
            traineeNameInput,
            traineeCodeInput,
            headerClassInput,
            sectorInput,
            qualificationInput,
            tradeInput,
            levelInput
        ].forEach((input) => {
            input?.addEventListener("input", syncReportHeaderState);
        });
        schoolNameInput?.addEventListener("input", () => {
            schoolNameInput.dataset.userCustomized = "true";
            syncReportHeaderState();
        });
        headerAcademicYearInput?.addEventListener("input", syncReportAcademicYearFromHeaderField);
        academicYearInput?.addEventListener("input", syncHeaderAcademicYearFromReportField);
        termInput?.addEventListener("input", () => {
            updateSummary();
        });
        termInput?.addEventListener("change", syncSubjectRowsFromStoredModuleMarks);
        conductInput?.addEventListener("input", () => {
            updateSummary();
        });
        multiTermSummaryWrap?.querySelectorAll("input[data-summary-field]").forEach((input) => {
            input.addEventListener("input", syncMultiTermSummaryState);
        });
        cancelEditButton?.addEventListener("click", resetReportForm);

        renderLogoPreview(reportHeaderState.logoDataUrl);

        addSubjectRow();
        setFormMode();
    }

    function renderStudentOptions() {
        if (!studentSelect) {
            return;
        }

        const currentValue = studentSelect.value;
        studentSelect.innerHTML = `<option value="">Select student</option>`;

        students.forEach((student) => {
            const option = document.createElement("option");
            option.value = student.id;
            option.textContent = student.fullName || "Unnamed student";
            studentSelect.appendChild(option);
        });

        if (students.some((student) => student.id === currentValue)) {
            studentSelect.value = currentValue;
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
            option.textContent = classItem.section
                ? `${classItem.className} • Section ${classItem.section}`
                : classItem.className || "Unnamed class";
            classSelect.appendChild(option);
        });

        if (classes.some((classItem) => classItem.id === currentValue)) {
            classSelect.value = currentValue;
        }
    }

    function renderAutoClassOptions() {
        if (!autoClassSelect) {
            return;
        }

        const currentValue = autoClassSelect.value;
        autoClassSelect.innerHTML = `<option value="">Select class</option>`;

        classes.forEach((classItem) => {
            const option = document.createElement("option");
            option.value = classItem.id;
            option.textContent = classItem.className || "Unnamed class";
            autoClassSelect.appendChild(option);
        });

        if (classes.some((classItem) => classItem.id === currentValue)) {
            autoClassSelect.value = currentValue;
        }
    }

    function syncAutoReportDefaults() {
        const selectedClass = classes.find((classItem) => classItem.id === `${autoClassSelect?.value || ""}`.trim());
        if (!selectedClass) {
            return;
        }

        if (classSelect && !classSelect.value) {
            classSelect.value = selectedClass.id;
            syncTeacherFromClass();
        }

        if (termInput && !termInput.value) {
            termInput.value = `${autoTermSelect?.value || ""}`.trim();
        }
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

    function syncClassFromStudent() {
        const selectedStudent = students.find((student) => student.id === studentSelect?.value);

        if (selectedStudent?.classId && classes.some((classItem) => classItem.id === selectedStudent.classId)) {
            classSelect.value = selectedStudent.classId;
            syncTeacherFromClass();
        }

        syncHeaderDefaultsFromSelection();
    }

    function syncTeacherFromClass() {
        const selectedClass = classes.find((classItem) => classItem.id === classSelect?.value);

        if (selectedClass?.teacherId && teachers.some((teacher) => teacher.id === selectedClass.teacherId)) {
            teacherSelect.value = selectedClass.teacherId;
        }

        syncHeaderDefaultsFromSelection();
    }

    function renderLogoPreview(logoDataUrl = "") {
        renderLogoBox(
            logoPreview,
            logoDataUrl,
            "PRIMARY LOGO",
            reportHeaderState.logoWidth,
            reportHeaderState.logoLength
        );
        if (logoRemoveButton) {
            logoRemoveButton.disabled = !logoDataUrl;
        }
    }

    function renderLogoBox(target, logoDataUrl = "", placeholderText = "SCHOOL LOGO", widthValue = "112", lengthValue = "64") {
        if (!target) {
            return;
        }

        target.style.width = `${normalizeLogoPreviewDimension(widthValue, 118)}px`;
        target.style.height = `${normalizeLogoPreviewDimension(lengthValue, 118)}px`;
        target.style.transition = "width 160ms ease, height 160ms ease";
        target.replaceChildren();

        if (logoDataUrl) {
            const image = document.createElement("img");
            image.src = logoDataUrl;
            image.alt = "School logo preview";
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "contain";
            target.appendChild(image);
            return;
        }

        const placeholder = document.createElement("span");
        placeholder.textContent = placeholderText;
        placeholder.style.fontSize = "0.82rem";
        placeholder.style.fontWeight = "700";
        placeholder.style.letterSpacing = "0.08em";
        placeholder.style.color = "rgba(223, 241, 255, 0.84)";
        placeholder.style.textAlign = "center";
        target.appendChild(placeholder);
    }

    function getReportHeader() {
        return normalizeTemporaryReportHeader({
            district: districtInput?.value,
            schoolName: schoolNameInput?.value || getResolvedSchoolName(),
            email: emailInput?.value,
            rtbFull: rtbFullInput?.value,
            contact: contactInput?.value,
            logoDataUrl: reportHeaderState.logoDataUrl,
            logoWidth: logoWidthInput?.value,
            logoLength: logoLengthInput?.value,
            secondaryLogoDataUrl: "",
            traineeName: traineeNameInput?.value,
            traineeCode: traineeCodeInput?.value,
            className: headerClassInput?.value,
            academicYear: headerAcademicYearInput?.value || academicYearInput?.value,
            sector: sectorInput?.value,
            qualification: qualificationInput?.value,
            trade: tradeInput?.value,
            level: levelInput?.value
        });
    }

    function syncReportHeaderState() {
        reportHeaderState = getReportHeader();
        return reportHeaderState;
    }

    function handleLogoSizeChange() {
        syncReportHeaderState();
        renderLogoPreview(reportHeaderState.logoDataUrl);
    }

    function syncReportAcademicYearFromHeaderField() {
        if (academicYearInput && headerAcademicYearInput) {
            academicYearInput.value = headerAcademicYearInput.value;
        }

        syncReportHeaderState();
    }

    function syncHeaderAcademicYearFromReportField() {
        if (headerAcademicYearInput && academicYearInput) {
            headerAcademicYearInput.value = academicYearInput.value;
        }

        syncReportHeaderState();
    }

    function syncHeaderDefaultsFromSelection() {
        const selectedStudent = students.find((student) => student.id === studentSelect?.value);
        const selectedClass = classes.find((classItem) => classItem.id === classSelect?.value);

        if (selectedStudent) {
            if (traineeNameInput && !traineeNameInput.value.trim()) {
                traineeNameInput.value = selectedStudent.fullName || "";
            }
            if (traineeCodeInput && !traineeCodeInput.value.trim()) {
                traineeCodeInput.value = selectedStudent.admissionNumber || "";
            }
            if (tradeInput && !tradeInput.value.trim()) {
                tradeInput.value = selectedStudent.tradeSection || "";
            }
        }

        if (selectedClass) {
            if (headerClassInput && !headerClassInput.value.trim()) {
                headerClassInput.value = selectedClass.className || "";
            }
            if (tradeInput && !tradeInput.value.trim()) {
                tradeInput.value = selectedClass.section || tradeInput.value;
            }
        }

        if (headerAcademicYearInput && !headerAcademicYearInput.value.trim() && academicYearInput?.value) {
            headerAcademicYearInput.value = academicYearInput.value;
        }

        syncReportHeaderState();
    }

    function syncSubjectRowsFromStoredModuleMarks() {
        if (editingReportId) {
            return;
        }

        const storedResultsFromMarks = buildStoredSubjectResultsFromMarks({
            modules,
            marks,
            studentId: `${studentSelect?.value || ""}`.trim(),
            classId: `${classSelect?.value || ""}`.trim(),
            term: `${termInput?.value || ""}`.trim()
        });
        const storedResults = storedResultsFromMarks.length > 0 ? storedResultsFromMarks : buildStoredModuleSubjectResults({
            modules,
            moduleMarks,
            studentId: `${studentSelect?.value || ""}`.trim(),
            classId: `${classSelect?.value || ""}`.trim(),
            term: `${termInput?.value || ""}`.trim()
        });

        if (storedResults.length === 0) {
            return;
        }

        populateSubjectRows(storedResults);
        updateSummary();
    }

    function handleLogoUpload(event, targetField, renderPreview, errorMessage) {
        const [file] = Array.from(event?.target?.files || []);

        if (!file) {
            reportHeaderState = {
                ...reportHeaderState,
                [targetField]: "",
                secondaryLogoDataUrl: ""
            };
            renderPreview("");
            syncReportHeaderState();
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            reportHeaderState = {
                ...reportHeaderState,
                [targetField]: `${reader.result || ""}`,
                secondaryLogoDataUrl: ""
            };
            renderPreview(reportHeaderState[targetField]);
            syncReportHeaderState();
        };
        reader.onerror = () => {
            console.error("School logo upload failed:", reader.error);
            onStatusChange?.(errorMessage, "error");
        };
        reader.readAsDataURL(file);
    }

    function handleLogoChange(event) {
        handleLogoUpload(event, "logoDataUrl", renderLogoPreview, "Could not read the uploaded school logo.");
    }

    function removeLogo() {
        reportHeaderState = {
            ...reportHeaderState,
            logoDataUrl: "",
            secondaryLogoDataUrl: ""
        };

        if (logoInput) {
            logoInput.value = "";
        }

        renderLogoPreview("");
        syncReportHeaderState();
    }

    function getMultiTermSummary() {
        const summary = createDefaultMultiTermSummary();
        const fieldNames = ["moduleWeight", "formativeAssessment", "integratedAssessment", "comprehensiveAssessment", "behavior"];

        ["term1", "term2", "term3", "annual"].forEach((termKey) => {
            fieldNames.forEach((fieldName) => {
                const input = multiTermSummaryWrap?.querySelector(`[data-term-key="${termKey}"][data-summary-field="${fieldName}"]`);
                if (input && summary[termKey]) {
                    summary[termKey][fieldName] = `${input.value || ""}`.trim();
                }
            });
        });

        return normalizeTemporaryMultiTermSummary(summary);
    }

    function syncMultiTermSummaryState() {
        multiTermSummaryState = getMultiTermSummary();
        setMultiTermFieldValues("annual", multiTermSummaryState.annual);
        return multiTermSummaryState;
    }

    function setMultiTermFieldValues(termKey, values = {}) {
        Object.entries(values).forEach(([fieldName, value]) => {
            const input = multiTermSummaryWrap?.querySelector(`[data-term-key="${termKey}"][data-summary-field="${fieldName}"]`);
            if (input) {
                input.value = `${value ?? ""}`;
            }
        });
    }

    function applyMultiTermSummaryToForm(summary = {}) {
        const normalizedSummary = normalizeTemporaryMultiTermSummary(summary);
        ["term1", "term2", "term3", "annual"].forEach((termKey) => {
            setMultiTermFieldValues(termKey, normalizedSummary[termKey]);
        });
        multiTermSummaryState = normalizedSummary;
    }

    function syncCurrentTermIntoMultiTermSummary(summary, subjectResults = []) {
        syncMultiTermSummaryState();
    }

    function setFormMode(report = null) {
        const isEditing = Boolean(report);
        if (formModeLabel) {
            formModeLabel.textContent = isEditing ? "Remake Report Card" : "Create Report Card";
        }
        if (formModeCopy) {
            formModeCopy.textContent = isEditing
                ? "This report is loaded for editing. Update the new TVET header and detailed term sections, then save to regenerate it."
                : "Enter CAMIS-style marks with EU, ET, TOTAL, percentage, grade, and final report summary before generating the official PDF.";
        }
        if (submitButton) {
            submitButton.textContent = isEditing ? "Update and regenerate report card" : "Save CAMIS report card";
        }
        if (cancelEditButton) {
            cancelEditButton.hidden = !isEditing;
        }
    }

    function populateSubjectRows(subjectResults = []) {
        if (subjectSectionWraps.size === 0) {
            return;
        }

        subjectSectionWraps.forEach((wrap) => {
            if (wrap) {
                wrap.innerHTML = "";
            }
        });
        if (subjectResults.length === 0) {
            addSubjectRow({ moduleType: DEFAULT_MODULE_SECTION });
            return;
        }

        subjectResults.forEach((subject) => addSubjectRow(subject));
    }

    function populateFormFromReport(report) {
        const normalizedReport = normalizeReportModel(report);
        const header = normalizedReport.reportHeader;

        editingReportId = normalizedReport.id;
        setFormMode(normalizedReport);

        if (titleInput) {
            titleInput.value = normalizedReport.title || "STUDENT REPORT CARD";
        }
        if (studentSelect) {
            studentSelect.value = normalizedReport.studentId || "";
        }
        if (classSelect) {
            classSelect.value = normalizedReport.classId || "";
        }
        if (teacherSelect) {
            teacherSelect.value = normalizedReport.teacherId || "";
        }
        if (termInput) {
            termInput.value = normalizedReport.term || "";
        }
        if (academicYearInput) {
            academicYearInput.value = normalizedReport.academicYear || "";
        }
        if (positionInput) {
            positionInput.value = normalizedReport.position || "";
        }
        if (conductInput) {
            conductInput.value = `${normalizedReport.conductScore || ""}`;
        }
        if (behaviorRemarksInput) {
            behaviorRemarksInput.value = normalizedReport.behaviorRemarks || "";
        }
        if (teacherCommentsInput) {
            teacherCommentsInput.value = normalizedReport.teacherComments || "";
        }
        if (headTeacherCommentsInput) {
            headTeacherCommentsInput.value = normalizedReport.headTeacherComments || "";
        }
        if (parentCommentsInput) {
            parentCommentsInput.value = normalizedReport.parentComments || "";
        }

        if (districtInput) {
            districtInput.value = header.district || "";
        }
        if (schoolNameInput) {
            schoolNameInput.value = header.schoolName || getResolvedSchoolName();
            if (header.schoolName) {
                schoolNameInput.dataset.userCustomized = "true";
            } else {
                delete schoolNameInput.dataset.userCustomized;
            }
        }
        if (emailInput) {
            emailInput.value = header.email || "";
        }
        if (rtbFullInput) {
            rtbFullInput.value = header.rtbFull || "";
        }
        if (contactInput) {
            contactInput.value = header.contact || "";
        }
        if (traineeNameInput) {
            traineeNameInput.value = header.traineeName || "";
        }
        if (traineeCodeInput) {
            traineeCodeInput.value = header.traineeCode || "";
        }
        if (headerClassInput) {
            headerClassInput.value = header.className || "";
        }
        if (headerAcademicYearInput) {
            headerAcademicYearInput.value = header.academicYear || normalizedReport.academicYear || "";
        }
        if (sectorInput) {
            sectorInput.value = header.sector || "";
        }
        if (qualificationInput) {
            qualificationInput.value = header.qualification || "";
        }
        if (tradeInput) {
            tradeInput.value = header.trade || "";
        }
        if (levelInput) {
            levelInput.value = header.level || "";
        }
        if (logoLengthInput) {
            logoLengthInput.value = header.logoLength || "64";
        }
        if (logoWidthInput) {
            logoWidthInput.value = header.logoWidth || "112";
        }

        reportHeaderState = {
            ...header
        };
        renderLogoPreview(reportHeaderState.logoDataUrl);

        populateSubjectRows(normalizedReport.subjectResults);
        applyMultiTermSummaryToForm(normalizedReport.multiTermSummary);
        updateSummary();

        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        onStatusChange?.("Report loaded into the editor. Update the fields and save to remake it.", "info");
    }

    function resetReportForm() {
        editingReportId = null;
        form?.reset();
        reportHeaderState = createDefaultReportHeader();
        multiTermSummaryState = createDefaultMultiTermSummary();
        renderLogoPreview("");
        populateSubjectRows([]);
        applyMultiTermSummaryToForm(multiTermSummaryState);
        renderStudentOptions();
        renderClassOptions();
        renderTeacherOptions();
        setFormMode();
        if (schoolNameInput) {
            delete schoolNameInput.dataset.userCustomized;
        }
        syncSchoolNameInput({ force: true });
        syncReportHeaderState();
        updateSummary();
    }

    function getSubjectRows() {
        return Array.from(panel?.querySelectorAll("[data-subject-row]") || []);
    }

    function updateSummary() {
        const subjectResults = getSubjectRows()
            .map((row) => {
                const subjectName = row.querySelector('[data-field="subjectName"]')?.value.trim();
                if (!subjectName) {
                    return null;
                }

                return calculateSubjectMetrics({
                    subjectName,
                    eu: row.querySelector('[data-field="eu"]')?.value,
                    et: row.querySelector('[data-field="et"]')?.value,
                    maxMarks: row.querySelector('[data-field="maxMarks"]')?.value,
                    moduleType: row.dataset.moduleType
                });
            })
            .filter(Boolean);

        const summary = calculateReportSummary(subjectResults, positionInput?.value);

        if (totalMarksOutput) {
            totalMarksOutput.textContent = `${summary.totalMarks}`;
        }

        if (maxMarksOutput) {
            maxMarksOutput.textContent = `${summary.maximumMarks}`;
        }

        if (percentageOutput) {
            percentageOutput.textContent = `${summary.percentage}%`;
        }

        if (finalGradeOutput) {
            finalGradeOutput.textContent = summary.finalGrade;
        }

        syncCurrentTermIntoMultiTermSummary(summary, subjectResults);

        return {
            subjectResults,
            summary
        };
    }

    function wireSubjectRow(row) {
        row.querySelectorAll('input[data-field="subjectName"], input[data-field="eu"], input[data-field="et"], input[data-field="maxMarks"]').forEach((input) => {
            input.addEventListener("input", () => {
                const subject = calculateSubjectMetrics({
                    subjectName: row.querySelector('[data-field="subjectName"]')?.value,
                    eu: row.querySelector('[data-field="eu"]')?.value,
                    et: row.querySelector('[data-field="et"]')?.value,
                    maxMarks: row.querySelector('[data-field="maxMarks"]')?.value,
                    moduleType: row.dataset.moduleType
                });

                row.querySelector('[data-field="total"]').value = `${subject.total}`;
                row.querySelector('[data-field="percentage"]').value = `${subject.percentage}`;
                row.querySelector('[data-field="grade"]').value = subject.grade;
                updateSummary();
            });
        });

        row.querySelector('[data-action="remove-subject"]')?.addEventListener("click", () => {
            row.remove();
            if (getSubjectRows().length === 0) {
                addSubjectRow({ moduleType: DEFAULT_MODULE_SECTION });
            }
            updateSummary();
        });
    }

    function addSubjectRow(defaults = {}) {
        const moduleType = normalizeModuleSection(defaults.moduleType || defaults.moduleSection || defaults.module || defaults.category);
        const targetWrap = subjectSectionWraps.get(moduleType) || subjectSectionWraps.get(DEFAULT_MODULE_SECTION);

        if (!targetWrap) {
            return;
        }

        const template = document.createElement("template");
        template.innerHTML = createSubjectRowMarkup({
            ...defaults,
            moduleType
        }).trim();
        const row = template.content.firstElementChild;
        row.dataset.moduleType = moduleType;
        targetWrap.appendChild(row);
        wireSubjectRow(row);
        updateSummary();
    }

    async function handleGenerateReports() {
        const classId = `${autoClassSelect?.value || ""}`.trim();
        const term = `${autoTermSelect?.value || ""}`.trim();
        const classItem = classes.find((item) => item.id === classId);
        const resolvedSchoolName = getResolvedSchoolName();

        if (!classItem || !term) {
            onStatusChange?.("Choose the class and term before generating report cards.", "error");
            return;
        }

        const classStudents = students.filter((student) => student.classId === classId);
        if (classStudents.length === 0) {
            onStatusChange?.("No students are linked to the selected class yet.", "error");
            return;
        }

        try {
            let generatedCount = 0;
            await withAppServiceLoading("Generating report cards from submitted module marks...", async () => {
                const generatedReports = classStudents.map((student) => {
                    const subjectResultsFromMarks = buildStoredSubjectResultsFromMarks({
                        modules,
                        marks,
                        studentId: student.id,
                        classId,
                        term
                    });
                    const subjectResults = subjectResultsFromMarks.length > 0
                        ? subjectResultsFromMarks
                        : buildStoredModuleSubjectResults({
                            modules,
                            moduleMarks,
                            studentId: student.id,
                            classId,
                            term
                        });

                    if (subjectResults.length === 0) {
                        return null;
                    }

                    const summary = calculateReportSummary(subjectResults);
                    return {
                        student,
                        subjectResults,
                        summary
                    };
                }).filter(Boolean).sort((left, right) => right.summary.percentage - left.summary.percentage);

                if (generatedReports.length === 0) {
                    throw new Error("No submitted marks were found for the selected class and term.");
                }

                for (const [index, item] of generatedReports.entries()) {
                    const teacher = teachers.find((entry) => entry.classId === classId && `${entry.title || ""}`.trim().toLowerCase() === "class teacher")
                        || teachers.find((entry) => entry.classId === classId)
                        || null;
                    const position = `${index + 1} out of ${generatedReports.length}`;
                    const summary = calculateReportSummary(item.subjectResults, position);
                    const existingReport = reports.find((report) => report.studentId === item.student.id && report.classId === classId && normalizeTermLookupValue(report.term) === normalizeTermLookupValue(term));

                    const reportPayload = {
                        title: "CAMIS REPORT CARD",
                        academicYear: `${new Date().getFullYear()}`,
                        studentId: item.student.id,
                        studentName: item.student.fullName || "",
                        admissionNumber: item.student.admissionNumber || item.student.traineeCode || "",
                        classId,
                        className: classItem.className || "",
                        teacherId: teacher?.id || classItem.teacherId || "",
                        teacherName: teacher?.fullName || classItem.teacherName || "",
                        term,
                        position,
                        conductScore: existingReport?.conductScore || "",
                        disciplineScore: existingReport?.disciplineScore || "",
                        behaviorRemarks: existingReport?.behaviorRemarks || "",
                        remarks: existingReport?.remarks || "",
                        teacherComments: existingReport?.teacherComments || "",
                        headTeacherComments: existingReport?.headTeacherComments || "",
                        parentComments: existingReport?.parentComments || "",
                        summary: existingReport?.summary || "",
                        subjectResults: item.subjectResults,
                        subjectScores: item.subjectResults,
                        totalMarks: summary.totalMarks,
                        maxMarks: summary.maximumMarks,
                        maximumMarks: summary.maximumMarks,
                        percentage: summary.percentage,
                        finalGrade: summary.finalGrade,
                        overallGrade: summary.finalGrade,
                        averageScore: summary.percentage,
                        reportHeader: normalizeTemporaryReportHeader({
                            ...(existingReport?.reportHeader || {}),
                            schoolName: resolvedSchoolName
                        }, {
                            studentName: item.student.fullName || "",
                            admissionNumber: item.student.admissionNumber || item.student.traineeCode || "",
                            className: classItem.className || "",
                            academicYear: `${new Date().getFullYear()}`,
                            sector: item.student.sector || classItem.sector || "",
                            trade: item.student.trade || classItem.trade || "",
                            level: item.student.level || classItem.level || "",
                            schoolName: resolvedSchoolName
                        }),
                        multiTermSummary: normalizeTemporaryMultiTermSummary(existingReport?.multiTermSummary, {
                            term,
                            summary,
                            subjectResults: item.subjectResults
                        }),
                        issuedOn: new Date().toISOString(),
                        layoutVersion: 2,
                        regeneratedAt: new Date().toISOString(),
                        source: "auto-generated-from-marks"
                    };

                    if (existingReport?.id) {
                        await schoolStore.updateReport(existingReport.id, reportPayload);
                    } else {
                        await schoolStore.addReport(reportPayload);
                    }
                }

                generatedCount = generatedReports.length;
            });

            syncAutoReportDefaults();
            onStatusChange?.(`Generated ${generatedCount} report card records for ${classItem.className || "the selected class"}.`, "success");
        } catch (error) {
            console.error("Automatic report generation failed:", error);
            onStatusChange?.(error?.message || "Could not generate report cards from the submitted marks.", "error");
        }
    }

    function renderReports() {
        if (!list || !emptyState || !countValue) {
            return;
        }

        list.replaceChildren(...reports.map((report) => createReportCard(report, handleGeneratePdf, populateFormFromReport)));
        emptyState.hidden = reports.length > 0;
        countValue.textContent = String(reports.length);
    }

    async function handleGeneratePdf(report) {
        try {
            const resolvedSchoolName = getResolvedSchoolName(report?.reportHeader?.schoolName || report?.schoolName);
            const fileName = await withAppServiceLoading("Generating CAMIS report card PDF...", async () => generateReportCardPdf({
                schoolName: resolvedSchoolName,
                report: {
                    ...report,
                    reportHeader: normalizeTemporaryReportHeader(report.reportHeader, {
                        ...report,
                        schoolName: resolvedSchoolName
                    }),
                    multiTermSummary: normalizeTemporaryMultiTermSummary(report.multiTermSummary)
                }
            }));
            onStatusChange?.(`CAMIS report card PDF downloaded: ${fileName}`, "success");
        } catch (error) {
            console.error("Report card PDF generation failed:", error);
            onStatusChange?.("Could not generate the CAMIS report card PDF.", "error");
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const title = `${titleInput?.value || "STUDENT REPORT CARD"}`.trim();
        const studentId = `${studentSelect?.value || ""}`.trim();
        const classId = `${classSelect?.value || ""}`.trim();
        const teacherId = `${teacherSelect?.value || ""}`.trim();
        const term = `${termInput?.value || ""}`.trim();
        const academicYear = `${academicYearInput?.value || ""}`.trim();
        const position = `${positionInput?.value || ""}`.trim();
        const conductScore = `${conductInput?.value || ""}`.trim();
        const behaviorRemarks = `${behaviorRemarksInput?.value || ""}`.trim();
        const teacherComments = `${teacherCommentsInput?.value || ""}`.trim();
        const headTeacherComments = `${headTeacherCommentsInput?.value || ""}`.trim();
        const parentComments = `${parentCommentsInput?.value || ""}`.trim();
        const reportHeader = syncReportHeaderState();
        const resolvedSchoolName = getResolvedSchoolName(reportHeader.schoolName);
        const student = students.find((item) => item.id === studentId);
        const classItem = classes.find((item) => item.id === classId);
        const teacher = teachers.find((item) => item.id === teacherId);
        const { subjectResults: manualSubjectResults, summary: manualSummary } = updateSummary();
        const storedSubjectResultsFromMarks = buildStoredSubjectResultsFromMarks({
            modules,
            marks,
            studentId: student?.id || studentId,
            classId: classItem?.id || classId,
            term
        });
        const storedModuleSubjectResults = storedSubjectResultsFromMarks.length > 0
            ? storedSubjectResultsFromMarks
            : buildStoredModuleSubjectResults({
            modules,
            moduleMarks,
            studentId: student?.id || studentId,
            classId: classItem?.id || classId,
            term
        });
        const subjectResults = storedModuleSubjectResults.length > 0 ? storedModuleSubjectResults : manualSubjectResults;
        const resolvedPosition = buildAutomaticPositionLabel({
            reports,
            classId: classItem?.id || classId,
            term,
            editingReportId,
            percentage: storedModuleSubjectResults.length > 0 ? calculateReportSummary(subjectResults).percentage : manualSummary.percentage
        }) || position;
        const summary = storedModuleSubjectResults.length > 0
            ? calculateReportSummary(subjectResults, resolvedPosition)
            : calculateReportSummary(manualSubjectResults, resolvedPosition);
        if (storedModuleSubjectResults.length > 0) {
            syncCurrentTermIntoMultiTermSummary(summary, subjectResults);
        }
        const multiTermSummary = syncMultiTermSummaryState();
        if (positionInput && resolvedPosition) {
            positionInput.value = resolvedPosition;
        }

        if (!title || !student || !classItem || !term || subjectResults.length === 0) {
            onStatusChange?.("Enter the report title, student, class, term, and at least one subject result before saving.", "error");
            return;
        }

        if (subjectResults.some((subject) => !subject.subjectName)) {
            onStatusChange?.("Every subject row must include a subject name.", "error");
            return;
        }

        const reportId = editingReportId;
        const isEditing = Boolean(reportId);
        const payloadToPersist = {
            title,
            academicYear,
            studentId: student.id,
            studentName: student.fullName || "",
            admissionNumber: student.admissionNumber || "",
            gender: student.gender || "",
            dob: student.dob || "",
            tradeSection: student.tradeSection || "",
            classId: classItem.id,
            className: classItem.className || "",
            teacherId: teacher?.id || classItem.teacherId || "",
            teacherName: teacher?.fullName || classItem.teacherName || "",
            term,
            position: resolvedPosition,
            conductScore,
            disciplineScore: conductScore,
            behaviorRemarks,
            remarks: behaviorRemarks,
            teacherComments,
            headTeacherComments,
            parentComments,
            summary: teacherComments,
            subjectResults,
            subjectScores: subjectResults,
            totalMarks: summary.totalMarks,
            maxMarks: summary.maximumMarks,
            maximumMarks: summary.maximumMarks,
            percentage: summary.percentage,
            finalGrade: summary.finalGrade,
            overallGrade: summary.finalGrade,
            averageScore: summary.percentage,
            reportHeader: {
                ...reportHeader,
                schoolName: resolvedSchoolName,
                email: reportHeader.email || "",
                rtbFull: reportHeader.rtbFull || "",
                contact: reportHeader.contact || "",
                logoWidth: reportHeader.logoWidth || "112",
                logoLength: reportHeader.logoLength || "64",
                secondaryLogoDataUrl: reportHeader.secondaryLogoDataUrl || "",
                traineeName: reportHeader.traineeName || student.fullName || "",
                traineeCode: reportHeader.traineeCode || student.admissionNumber || "",
                className: reportHeader.className || classItem.className || "",
                academicYear: reportHeader.academicYear || academicYear,
                trade: reportHeader.trade || student.tradeSection || "",
                district: reportHeader.district || "",
                sector: reportHeader.sector || "",
                qualification: reportHeader.qualification || "",
                level: reportHeader.level || ""
            },
            multiTermSummary,
            issuedOn: new Date().toISOString(),
            layoutVersion: 2,
            regeneratedAt: new Date().toISOString()
        };

        try {
            const fileName = await withAppServiceLoading(
                isEditing ? "Updating and regenerating the report card..." : "Saving and generating the report card...",
                async () => {
                    if (isEditing) {
                        await schoolStore.updateReport(reportId, payloadToPersist);
                    } else {
                        await schoolStore.addReport(payloadToPersist);
                    }

                    return generateReportCardPdf({
                        schoolName: resolvedSchoolName,
                        report: {
                            id: reportId || undefined,
                            ...payloadToPersist
                        }
                    });
                }
            );

            resetReportForm();
            onStatusChange?.(
                isEditing
                    ? `Report card updated and regenerated: ${fileName}`
                    : `CAMIS report card saved and generated: ${fileName}`,
                "success"
            );
        } catch (error) {
            console.error("Report save failed:", error);
            onStatusChange?.(isEditing ? "Could not update the report card." : "Could not save the CAMIS report card.", "error");
        }
    }

    return {
        init() {
            renderShell();

            const unsubscribeReports = schoolStore.subscribe("reports", (items) => {
                reports = items.map(normalizeReportModel);
                renderReports();
            });
            const unsubscribeStudents = schoolStore.subscribe("students", (items) => {
                students = items;
                renderStudentOptions();
            });
            const unsubscribeClasses = schoolStore.subscribe("classes", (items) => {
                classes = items;
                renderClassOptions();
                renderAutoClassOptions();
            });
            const unsubscribeTeachers = schoolStore.subscribe("teachers", (items) => {
                teachers = items;
                renderTeacherOptions();
            });
            const unsubscribeSchoolSettings = schoolStore.subscribe("schoolSettings", (items) => {
                currentSchoolSetting = items[0] || null;
                syncSchoolNameInput();
            });
            const unsubscribeModules = schoolStore.subscribe("modules", (items) => {
                modules = items;
                syncSubjectRowsFromStoredModuleMarks();
            });
            const unsubscribeModuleMarks = schoolStore.subscribe("moduleMarks", (items) => {
                moduleMarks = items;
                syncSubjectRowsFromStoredModuleMarks();
            });
            const unsubscribeAssignments = schoolStore.subscribe("assignments", (items) => {
                assignments = items;
            });
            const unsubscribeMarks = schoolStore.subscribe("marks", (items) => {
                marks = items;
                syncSubjectRowsFromStoredModuleMarks();
            });

            return {
                destroy() {
                    unsubscribeReports();
                    unsubscribeStudents();
                    unsubscribeClasses();
                    unsubscribeTeachers();
                    unsubscribeSchoolSettings();
                    unsubscribeModules();
                    unsubscribeModuleMarks();
                    unsubscribeAssignments();
                    unsubscribeMarks();
                }
            };
        }
    };
}
