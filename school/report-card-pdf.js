import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";
import { formatDisplayDate, sanitizeFileSegment } from "./shared.js";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 28;
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);
const SAFE_BOTTOM = PAGE_HEIGHT - 40;
const DEFAULT_MODULE_SECTION = "general";
const MODULE_SECTIONS = [
    { key: "complementary", label: "COMPLEMENTARY MODULES:" },
    { key: "general", label: "GENERAL MODULES:" },
    { key: "specific", label: "SPECIFIC MODULES:" }
];

function normalizeText(value, fallback = "N/A") {
    const text = `${value ?? ""}`.trim();
    return text || fallback;
}

function normalizeOptionalText(value) {
    return `${value ?? ""}`.trim();
}

function toNumber(value) {
    const numericValue = Number.parseFloat(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundToOne(value) {
    return Math.round(value * 10) / 10;
}

function normalizeLogoPdfDimension(value, fallback, minimum, maximum) {
    const numericValue = Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(maximum, Math.max(minimum, Math.round(numericValue)));
}

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

export function getCamisGrade(percentage) {
    if (percentage >= 80) {
        return "A";
    }
    if (percentage >= 75) {
        return "B";
    }
    if (percentage >= 70) {
        return "C";
    }
    if (percentage >= 65) {
        return "D";
    }
    if (percentage >= 60) {
        return "E";
    }
    if (percentage >= 50) {
        return "S";
    }
    return "F";
}

export function calculateSubjectMetrics(subject = {}) {
    const eu = toNumber(subject.eu);
    const et = toNumber(subject.et);
    const maxMarks = Math.max(toNumber(subject.maxMarks || subject.max || subject.weight || 100), 1);
    const total = roundToOne(subject.total ?? eu + et);
    const percentage = roundToOne(subject.percentage ?? ((total / maxMarks) * 100));

    return {
        subjectName: normalizeText(subject.subjectName, "Subject"),
        moduleType: normalizeModuleSection(subject.moduleType || subject.moduleSection || subject.module || subject.category),
        eu: roundToOne(eu),
        et: roundToOne(et),
        maxMarks,
        total,
        percentage,
        grade: normalizeText(subject.grade, getCamisGrade(percentage))
    };
}

export function calculateReportSummary(subjectResults = [], position = "N/A") {
    const totalMarks = roundToOne(subjectResults.reduce((sum, subject) => sum + subject.total, 0));
    const maximumMarks = roundToOne(subjectResults.reduce((sum, subject) => sum + subject.maxMarks, 0));
    const percentage = maximumMarks > 0 ? roundToOne((totalMarks / maximumMarks) * 100) : 0;

    return {
        totalMarks,
        maximumMarks,
        percentage,
        finalGrade: getCamisGrade(percentage),
        position: normalizeText(position, "N/A")
    };
}

function normalizeStudentProfile(studentProfile = {}) {
    return {
        name: normalizeText(studentProfile.name, "Student not specified"),
        admissionNumber: normalizeText(studentProfile.admissionNumber, "N/A"),
        className: normalizeText(studentProfile.class || studentProfile.className, "N/A"),
        gender: normalizeText(studentProfile.gender, "N/A"),
        dob: studentProfile.dob ? formatDisplayDate(studentProfile.dob) : "N/A",
        tradeSection: normalizeText(
            studentProfile.tradeSection || studentProfile.trade || studentProfile.section || studentProfile["trade/section"],
            "N/A"
        )
    };
}

function normalizeReportHeader(reportHeader = {}, context = {}) {
    const studentProfile = context.studentProfile || normalizeStudentProfile();
    const fallbackAcademicYear = `${context.academicYear ?? new Date().getFullYear()}`;

    return {
        district: normalizeText(reportHeader.district, ""),
        schoolName: normalizeText(reportHeader.schoolName || context.schoolName, "N/A"),
        email: normalizeText(reportHeader.email, ""),
        rtbFull: normalizeText(reportHeader.rtbFull || reportHeader.rtb, ""),
        contact: normalizeText(reportHeader.contact, ""),
        logoDataUrl: `${reportHeader.logoDataUrl ?? reportHeader.schoolLogo ?? ""}`.trim(),
        logoWidth: `${reportHeader.logoWidth ?? "112"}`.trim() || "112",
        logoLength: `${reportHeader.logoLength ?? reportHeader.logoHeight ?? "64"}`.trim() || "64",
        secondaryLogoDataUrl: `${reportHeader.secondaryLogoDataUrl ?? reportHeader.altLogoDataUrl ?? ""}`.trim(),
        traineeName: normalizeText(reportHeader.traineeName || studentProfile.name, "N/A"),
        traineeCode: normalizeText(reportHeader.traineeCode || studentProfile.admissionNumber, "N/A"),
        className: normalizeText(reportHeader.className || studentProfile.className, "N/A"),
        academicYear: normalizeText(reportHeader.academicYear || context.academicYear, fallbackAcademicYear),
        sector: normalizeText(reportHeader.sector, "N/A"),
        qualification: normalizeText(reportHeader.qualification || reportHeader.qualificationTitle, "N/A"),
        trade: normalizeText(reportHeader.trade || studentProfile.tradeSection, "N/A"),
        level: normalizeText(reportHeader.level || reportHeader.rtqfLevel, "N/A")
    };
}

function getDataUrlImageFormat(dataUrl = "") {
    const match = /^data:image\/(png|jpe?g|webp);/i.exec(dataUrl);
    if (!match) {
        return null;
    }

    const format = match[1].toUpperCase();
    return format === "JPG" ? "JPEG" : format;
}

function drawLabeledCell(doc, { x, y, width, height, label, value, valueSize = 9, maxLines = 2 }) {
    doc.rect(x, y, width, height);
    doc.setFont("times", "bold");
    doc.setFontSize(7.2);
    doc.text(label, x + 6, y + 11);
    doc.setFont("times", "normal");
    doc.setFontSize(valueSize);
    const lines = doc.splitTextToSize(normalizeText(value, "N/A"), width - 12).slice(0, maxLines);
    doc.text(lines, x + 6, y + 24);
}

function drawInlineField(doc, { x, y, label, value, width }) {
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, x, y);
    doc.setFont("times", "normal");
    doc.text(doc.splitTextToSize(normalizeText(value, "N/A"), Math.max(width - 80, 80)).slice(0, 2), x + 78, y);
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
    const moduleWeight = normalizeOptionalText(term.moduleWeight ?? term.totalMarks ?? defaults.moduleWeight);
    const formativeAssessment = normalizeOptionalText(term.formativeAssessment ?? term.eu ?? defaults.formativeAssessment);
    const integratedAssessment = normalizeOptionalText(term.integratedAssessment ?? term.integrated ?? defaults.integratedAssessment);
    const comprehensiveAssessment = normalizeOptionalText(term.comprehensiveAssessment ?? term.et ?? defaults.comprehensiveAssessment);
    const behavior = normalizeOptionalText(term.behavior ?? defaults.behavior);
    const percentage = normalizeOptionalText(term.percentage ?? defaults.percentage);
    const grade = normalizeOptionalText(term.grade ?? defaults.grade);

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

function calculateAnnualTermMetrics(summary) {
    const annual = {
        ...summary.annual,
        label: "ANNUAL"
    };

    ["moduleWeight", "formativeAssessment", "integratedAssessment", "comprehensiveAssessment", "behavior"].forEach((fieldName) => {
        const total = ["term1", "term2", "term3"]
            .map((termKey) => toNumber(summary[termKey]?.[fieldName]))
            .reduce((sum, value) => sum + value, 0);

        annual[fieldName] = total > 0 ? `${roundToOne(total)}` : "";
    });

    annual.totalMarks = annual.moduleWeight;

    const percentages = ["term1", "term2", "term3"]
        .map((termKey) => toNumber(summary[termKey]?.percentage))
        .filter((value) => value > 0);
    const annualPercentage = percentages.length > 0
        ? roundToOne(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
        : 0;

    annual.percentage = annualPercentage > 0 ? `${annualPercentage}` : "";
    annual.grade = annualPercentage > 0 ? getCamisGrade(annualPercentage) : "";

    return annual;
}

function normalizeMultiTermSummary(multiTermSummary = {}, context = {}) {
    const defaults = createDefaultMultiTermSummary();
    const next = {
        term1: normalizeTermMetrics(multiTermSummary.term1, defaults.term1),
        term2: normalizeTermMetrics(multiTermSummary.term2, defaults.term2),
        term3: normalizeTermMetrics(multiTermSummary.term3, defaults.term3),
        annual: normalizeTermMetrics(multiTermSummary.annual, defaults.annual)
    };

    next.annual = calculateAnnualTermMetrics(next);
    return next;
}

function normalizeLegacySubject(item = {}) {
    if (typeof item === "string") {
        return calculateSubjectMetrics({
            subjectName: item
        });
    }

    if ("eu" in item || "et" in item || "maxMarks" in item || "max" in item) {
        return calculateSubjectMetrics(item);
    }

    const legacyScore = toNumber(item.score ?? item.scoreText ?? 0);
    return calculateSubjectMetrics({
        subjectName: item.subject || item.subjectName || "Subject",
        eu: legacyScore,
        et: 0,
        maxMarks: item.maxMarks || item.max || 100
    });
}

function mapLegacyPayload(payload = {}) {
    const report = payload.report || {};
    const subjectResults = Array.isArray(report.subjectResults)
        ? report.subjectResults.map(normalizeLegacySubject)
        : Array.isArray(report.subjectScores)
            ? report.subjectScores.map(normalizeLegacySubject)
            : [];
    const studentProfile = normalizeStudentProfile({
        name: report.studentName,
        admissionNumber: report.admissionNumber,
        class: report.className,
        gender: report.gender,
        dob: report.dob,
        tradeSection: report.tradeSection || report.section
    });
    const summary = calculateReportSummary(subjectResults, report.position);

    return {
        schoolName: normalizeText(payload.schoolName || report.reportHeader?.schoolName || report.schoolName, "JohnyBrowserHub School Management"),
        reportTitle: normalizeText(report.title, "STUDENT REPORT CARD"),
        academicYear: normalizeText(report.academicYear, `${new Date().getFullYear()}`),
        term: normalizeText(report.term, "Current Term"),
        studentProfile,
        reportHeader: normalizeReportHeader(report.reportHeader || payload.reportHeader, {
            studentProfile,
            academicYear: report.academicYear,
            schoolName: payload.schoolName || report.schoolName
        }),
        subjectResults,
        summary: {
            ...summary,
            totalMarks: roundToOne(report.totalMarks ?? summary.totalMarks),
            maximumMarks: roundToOne(report.maxMarks ?? report.maximumMarks ?? summary.maximumMarks),
            percentage: roundToOne(report.percentage ?? summary.percentage),
            finalGrade: normalizeText(report.finalGrade || report.overallGrade, summary.finalGrade),
            position: normalizeText(report.position, summary.position)
        },
        conduct: {
            behaviorRemarks: normalizeText(report.behaviorRemarks || report.remarks || report.summary, "No conduct remarks provided."),
            disciplineScore: normalizeText(report.conductScore || report.disciplineScore, "N/A")
        },
        comments: {
            teacherComments: normalizeText(report.teacherComments || report.summary, "No teacher comments provided."),
            headTeacherComments: normalizeText(report.headTeacherComments, "No head teacher comments provided."),
            parentComments: normalizeText(report.parentComments, "No parent comments provided.")
        },
        multiTermSummary: normalizeMultiTermSummary(report.multiTermSummary, {
            term: report.term,
            summary: {
                totalMarks: roundToOne(report.totalMarks ?? summary.totalMarks),
                percentage: roundToOne(report.percentage ?? summary.percentage),
                finalGrade: normalizeText(report.finalGrade || report.overallGrade, summary.finalGrade)
            },
            conductScore: report.conductScore || report.disciplineScore,
            subjectResults
        }),
        signatures: {
            classTeacher: normalizeText(report.teacherName || report.classTeacher, "Class Teacher"),
            headTeacher: normalizeText(report.headTeacher || report.headTeacherName, "Head Teacher"),
            parentGuardian: normalizeText(report.parentGuardian || report.parentName, "Parent / Guardian")
        }
    };
}

function normalizeCamisPayload(payload = {}) {
    if (!payload.studentProfile) {
        return mapLegacyPayload(payload);
    }

    const subjectResults = (Array.isArray(payload.subjectResults) ? payload.subjectResults : payload.academicResults || [])
        .map(normalizeLegacySubject);
    const summary = calculateReportSummary(subjectResults, payload.summary?.position || payload.position);
    const studentProfile = normalizeStudentProfile(payload.studentProfile);

    return {
        schoolName: normalizeText(payload.schoolName || payload.reportHeader?.schoolName, "JohnyBrowserHub School Management"),
        reportTitle: normalizeText(payload.reportTitle, "STUDENT REPORT CARD"),
        academicYear: normalizeText(payload.academicYear, `${new Date().getFullYear()}`),
        term: normalizeText(payload.term, "Current Term"),
        studentProfile,
        reportHeader: normalizeReportHeader(payload.reportHeader, {
            studentProfile,
            academicYear: payload.academicYear,
            schoolName: payload.schoolName
        }),
        subjectResults,
        summary: {
            totalMarks: roundToOne(payload.summary?.totalMarks ?? summary.totalMarks),
            maximumMarks: roundToOne(payload.summary?.maximumMarks ?? summary.maximumMarks),
            percentage: roundToOne(payload.summary?.percentage ?? summary.percentage),
            finalGrade: normalizeText(payload.summary?.finalGrade, summary.finalGrade),
            position: normalizeText(payload.summary?.position || payload.position, summary.position)
        },
        conduct: {
            behaviorRemarks: normalizeText(payload.conduct?.behaviorRemarks, "No conduct remarks provided."),
            disciplineScore: normalizeText(payload.conduct?.disciplineScore, "N/A")
        },
        comments: {
            teacherComments: normalizeText(payload.comments?.teacherComments, "No teacher comments provided."),
            headTeacherComments: normalizeText(payload.comments?.headTeacherComments, "No head teacher comments provided."),
            parentComments: normalizeText(payload.comments?.parentComments, "No parent comments provided.")
        },
        multiTermSummary: normalizeMultiTermSummary(payload.multiTermSummary, {
            term: payload.term,
            summary: {
                totalMarks: roundToOne(payload.summary?.totalMarks ?? summary.totalMarks),
                percentage: roundToOne(payload.summary?.percentage ?? summary.percentage),
                finalGrade: normalizeText(payload.summary?.finalGrade, summary.finalGrade)
            },
            conductScore: payload.conduct?.disciplineScore,
            subjectResults
        }),
        signatures: {
            classTeacher: normalizeText(payload.signatures?.classTeacher, "Class Teacher"),
            headTeacher: normalizeText(payload.signatures?.headTeacher, "Head Teacher"),
            parentGuardian: normalizeText(payload.signatures?.parentGuardian, "Parent / Guardian")
        }
    };
}

function createRuntime(payload) {
    return {
        doc: new jsPDF({
            orientation: "portrait",
            unit: "pt",
            format: "a4"
        }),
        pageNumber: 0,
        payload
    };
}

function addPage(runtime) {
    if (runtime.pageNumber > 0) {
        runtime.doc.addPage();
    }

    runtime.pageNumber += 1;
    const { doc } = runtime;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.2);
    doc.rect(PAGE_MARGIN, PAGE_MARGIN, CONTENT_WIDTH, PAGE_HEIGHT - (PAGE_MARGIN * 2));

    return PAGE_MARGIN + 12;
}

function ensureSpace(runtime, cursorY, neededHeight) {
    return cursorY + neededHeight <= SAFE_BOTTOM ? cursorY : addPage(runtime);
}

function drawHeader(runtime, cursorY) {
    const { doc, payload } = runtime;
    const header = payload.reportHeader;
    const topY = cursorY;
    const leftLogoX = PAGE_MARGIN;
    const rightLogoX = PAGE_MARGIN + CONTENT_WIDTH - 52;
    const centerX = PAGE_MARGIN + (CONTENT_WIDTH / 2);
    const fieldTopY = topY + 68;

    const drawLogo = (dataUrl, x, y) => {
        if (!dataUrl) {
            return;
        }

        try {
            doc.addImage(dataUrl, getDataUrlImageFormat(dataUrl) || "PNG", x, y, 46, 46);
        } catch (error) {
            console.error("School logo render failed:", error);
        }
    };

    drawLogo(header.logoDataUrl, leftLogoX, topY + 2);
    drawLogo(header.secondaryLogoDataUrl, rightLogoX, topY + 2);

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("REPUBLIC OF RWANDA", centerX, topY + 16, { align: "center" });
    doc.text("MINISTRY OF EDUCATION", centerX, topY + 31, { align: "center" });
    doc.text("RWANDA TVET BOARD", centerX, topY + 46, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text(normalizeText(header.schoolName || payload.schoolName, "JohnyBrowserHub School Management"), centerX, topY + 60, { align: "center" });

    drawInlineField(doc, {
        x: PAGE_MARGIN,
        y: fieldTopY,
        label: "TRAINEE'S NAME",
        value: header.traineeName,
        width: (CONTENT_WIDTH / 2) - 12
    });
    drawInlineField(doc, {
        x: PAGE_MARGIN + (CONTENT_WIDTH / 2) + 4,
        y: fieldTopY,
        label: "TRAINEE CODE",
        value: header.traineeCode,
        width: (CONTENT_WIDTH / 2) - 4
    });
    drawInlineField(doc, {
        x: PAGE_MARGIN,
        y: fieldTopY + 18,
        label: "CLASS",
        value: header.className,
        width: (CONTENT_WIDTH / 2) - 12
    });
    drawInlineField(doc, {
        x: PAGE_MARGIN + (CONTENT_WIDTH / 2) + 4,
        y: fieldTopY + 18,
        label: "ACADEMIC YEAR",
        value: header.academicYear,
        width: (CONTENT_WIDTH / 2) - 4
    });

    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.text(`${payload.reportTitle} • ${payload.term}`, centerX, fieldTopY + 40, { align: "center" });

    return fieldTopY + 54;
}

function drawStudentInfo(runtime, cursorY) {
    const { doc, payload } = runtime;
    const rowHeight = 22;
    const leftWidth = CONTENT_WIDTH / 2;
    const rightX = PAGE_MARGIN + leftWidth;

    [
        [`Gender: ${payload.studentProfile.gender}`, `DOB: ${payload.studentProfile.dob}`],
        [`Trade / Section: ${payload.studentProfile.tradeSection}`, `Page: ${runtime.pageNumber}`]
    ].forEach((row, index) => {
        const y = cursorY + (index * rowHeight);
        doc.rect(PAGE_MARGIN, y, leftWidth, rowHeight);
        doc.rect(rightX, y, leftWidth, rowHeight);
        doc.text(row[0], PAGE_MARGIN + 8, y + 15);
        doc.text(row[1], rightX + 8, y + 15);
    });

    return cursorY + (rowHeight * 2) + 10;
}

function drawResultsTable(runtime, cursorY) {
    const { doc, payload } = runtime;
    const headers = ["Subject", "EU", "ET", "TOTAL", "%", "GRADE"];
    const columnWidths = [220, 56, 56, 62, 52, 70];
    const rowHeight = 20;
    let y = cursorY;

    const drawHeaderRow = () => {
        let x = PAGE_MARGIN;
        doc.setFont("times", "bold");
        headers.forEach((header, index) => {
            doc.rect(x, y, columnWidths[index], rowHeight);
            doc.text(header, x + 6, y + 14);
            x += columnWidths[index];
        });
        y += rowHeight;
    };

    drawHeaderRow();

    const rows = payload.subjectResults.length > 0
        ? payload.subjectResults
        : [calculateSubjectMetrics({ subjectName: "No subjects entered" })];

    rows.forEach((subject) => {
        y = ensureSpace(runtime, y, rowHeight + 24);
        if (y === PAGE_MARGIN + 12) {
            y = drawHeader(runtime, y);
            y = drawStudentInfo(runtime, y);
            drawHeaderRow();
        }

        let x = PAGE_MARGIN;
        const values = [
            subject.subjectName,
            `${subject.eu}`,
            `${subject.et}`,
            `${subject.total}`,
            `${subject.percentage}`,
            subject.grade
        ];

        doc.setFont("times", "normal");
        values.forEach((value, index) => {
            doc.rect(x, y, columnWidths[index], rowHeight);
            doc.text(value, x + 6, y + 14);
            x += columnWidths[index];
        });

        y += rowHeight;
    });

    return y + 10;
}

function buildMultiTermRows(payload) {
    const metrics = [
        ["moduleWeight", "Module Weight (Total Marks)"],
        ["formativeAssessment", "Formative Assessment (EU)"],
        ["integratedAssessment", "Integrated Assessment"],
        ["comprehensiveAssessment", "Comprehensive Assessment (ET)"],
        ["behavior", "Behavior"]
    ];

    return metrics.map(([fieldName, label]) => ({
        label,
        term1: normalizeOptionalText(payload.multiTermSummary.term1[fieldName]),
        term2: normalizeOptionalText(payload.multiTermSummary.term2[fieldName]),
        term3: normalizeOptionalText(payload.multiTermSummary.term3[fieldName]),
        annual: normalizeOptionalText(payload.multiTermSummary.annual[fieldName])
    }));
}

function drawSummarySection(runtime, cursorY) {
    const { doc, payload } = runtime;
    const summary = payload.summary;
    const rowHeight = 22;
    const labelWidth = 160;
    const valueWidth = CONTENT_WIDTH - labelWidth;
    let y = ensureSpace(runtime, cursorY, (rowHeight * 5) + 14);

    if (y === PAGE_MARGIN + 12) {
        y = drawHeader(runtime, y);
        y = drawStudentInfo(runtime, y);
    }

    [
        ["Total Marks", `${summary.totalMarks}`],
        ["Maximum Marks", `${summary.maximumMarks}`],
        ["Percentage", `${summary.percentage}%`],
        ["Final Grade", summary.finalGrade],
        ["Position", summary.position]
    ].forEach((row, index) => {
        const rowY = y + (index * rowHeight);
        doc.rect(PAGE_MARGIN, rowY, labelWidth, rowHeight);
        doc.rect(PAGE_MARGIN + labelWidth, rowY, valueWidth, rowHeight);
        doc.setFont("times", "bold");
        doc.text(row[0], PAGE_MARGIN + 6, rowY + 15);
        doc.setFont("times", "normal");
        doc.text(row[1], PAGE_MARGIN + labelWidth + 6, rowY + 15);
    });

    return y + (rowHeight * 5) + 10;
}

function drawMultiTermSummary(runtime, cursorY) {
    const { doc, payload } = runtime;
    const headers = ["Subject / Row", "TERM 1", "TERM 2", "TERM 3", "ANNUAL"];
    const columnWidths = [187, 88, 88, 88, 88];
    const rowHeight = 22;
    const rows = buildMultiTermRows(payload);
    let y = ensureSpace(runtime, cursorY, 60 + (rows.length * rowHeight));

    if (y === PAGE_MARGIN + 12) {
        y = drawHeader(runtime, y);
    }

    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("MULTI-TERM PERFORMANCE TABLE", PAGE_MARGIN + 6, y + 10);
    y += 18;

    let x = PAGE_MARGIN;
    headers.forEach((header, index) => {
        doc.rect(x, y, columnWidths[index], rowHeight);
        doc.text(header, x + 6, y + 14);
        x += columnWidths[index];
    });
    y += rowHeight;

    rows.forEach((row) => {
        y = ensureSpace(runtime, y, rowHeight + 28);
        if (y === PAGE_MARGIN + 12) {
            y = drawHeader(runtime, y);
            x = PAGE_MARGIN;
            headers.forEach((header, index) => {
                doc.rect(x, y, columnWidths[index], rowHeight);
                doc.text(header, x + 6, y + 14);
                x += columnWidths[index];
            });
            y += rowHeight;
        }

        const values = [row.label, row.term1, row.term2, row.term3, row.annual];
        let columnX = PAGE_MARGIN;
        doc.setFont("times", "normal");
        values.forEach((value, index) => {
            doc.rect(columnX, y, columnWidths[index], rowHeight);
            doc.text(normalizeOptionalText(value), columnX + 6, y + 14);
            columnX += columnWidths[index];
        });
        y += rowHeight;
    });

    return y + 10;
}

function drawConductAndComments(runtime, cursorY) {
    const { doc, payload } = runtime;
    const boxHeight = 48;
    const longBoxHeight = 60;

    const blocks = [
        { title: "Conduct (/40)", value: `${payload.conduct.disciplineScore}`, height: boxHeight },
        { title: "Behavior Remarks", value: payload.conduct.behaviorRemarks, height: longBoxHeight },
        { title: "Teacher Comments", value: payload.comments.teacherComments, height: longBoxHeight },
        { title: "Head Teacher Comments", value: payload.comments.headTeacherComments, height: longBoxHeight },
        { title: "Parent Comments", value: payload.comments.parentComments, height: longBoxHeight }
    ];

    let y = cursorY;
    blocks.forEach((block) => {
        y = ensureSpace(runtime, y, block.height + 10);
        if (y === PAGE_MARGIN + 12) {
            y = drawHeader(runtime, y);
            y = drawStudentInfo(runtime, y);
        }

        doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, block.height);
        doc.setFont("times", "bold");
        doc.text(block.title, PAGE_MARGIN + 6, y + 14);
        doc.setFont("times", "normal");
        const wrapped = doc.splitTextToSize(block.value, CONTENT_WIDTH - 16);
        doc.text(wrapped, PAGE_MARGIN + 6, y + 30);
        y += block.height + 8;
    });

    return y;
}

function drawSignatures(runtime, cursorY) {
    const { doc, payload } = runtime;
    const lineY = cursorY + 28;
    const lineWidth = (CONTENT_WIDTH - 36) / 3;
    const labels = [
        payload.signatures.classTeacher,
        payload.signatures.headTeacher,
        payload.signatures.parentGuardian
    ];

    labels.forEach((label, index) => {
        const x = PAGE_MARGIN + (index * (lineWidth + 18));
        doc.line(x, lineY, x + lineWidth, lineY);
        doc.text(label, x, lineY + 14);
    });
}

function formatMark(value, fallback = "") {
    if (value === "" || value === null || value === undefined) {
        return fallback;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return `${value}`;
    }

    return Number.isInteger(numericValue) ? `${numericValue}` : `${roundToOne(numericValue)}`;
}

function getGradeValue(grade) {
    switch (`${grade || ""}`.trim().toUpperCase()) {
    case "A":
        return 6;
    case "B":
        return 5;
    case "C":
        return 4;
    case "D":
        return 3;
    case "E":
        return 2;
    case "S":
        return 1;
    default:
        return 0;
    }
}

function drawCellText(doc, text, x, y, width, height, options = {}) {
    const {
        align = "left",
        fontStyle = "normal",
        fontSize = 8,
        padding = 4,
        maxLines = 1,
        shrinkToFit = false,
        minFontSize = 5.8
    } = options;

    const availableWidth = Math.max(width - (padding * 2), 20);
    const content = `${text ?? ""}`;
    let activeFontSize = fontSize;

    doc.setFont("times", fontStyle);
    doc.setFontSize(activeFontSize);

    let allLines = doc.splitTextToSize(content, availableWidth);
    while (shrinkToFit && allLines.length > maxLines && activeFontSize > minFontSize) {
        activeFontSize = Math.max(minFontSize, roundToOne((activeFontSize - 0.2) * 10) / 10);
        doc.setFontSize(activeFontSize);
        allLines = doc.splitTextToSize(content, availableWidth);
        if (activeFontSize === minFontSize) {
            break;
        }
    }

    const lines = allLines.slice(0, maxLines);
    const textBaselineY = y + (height / 2) - (((lines.length - 1) * activeFontSize * 0.52) / 2) + (activeFontSize * 0.32);

    if (align === "center") {
        doc.text(lines, x + (width / 2), textBaselineY, { align: "center" });
        return;
    }

    if (align === "right") {
        doc.text(lines, x + width - padding, textBaselineY, { align: "right" });
        return;
    }

    doc.text(lines, x + padding, textBaselineY);
}

function drawRectCell(doc, x, y, width, height, text = "", options = {}) {
    doc.rect(x, y, width, height);
    if (text) {
        drawCellText(doc, text, x, y, width, height, options);
    }
}

function drawPseudoQr(doc, x, y, size, seedText) {
    const gridSize = 21;
    const cellSize = size / gridSize;
    let hash = 2166136261;

    `${seedText || "CAMIS"}`.split("").forEach((character) => {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    });

    const fillModule = (column, row) => {
        doc.rect(x + (column * cellSize), y + (row * cellSize), cellSize, cellSize, "F");
    };

    const drawFinder = (startColumn, startRow) => {
        for (let row = 0; row < 7; row += 1) {
            for (let column = 0; column < 7; column += 1) {
                const isEdge = row === 0 || row === 6 || column === 0 || column === 6;
                const isCenter = row >= 2 && row <= 4 && column >= 2 && column <= 4;
                if (isEdge || isCenter) {
                    fillModule(startColumn + column, startRow + row);
                }
            }
        }
    };

    doc.setFillColor(0, 0, 0);
    drawFinder(0, 0);
    drawFinder(gridSize - 7, 0);
    drawFinder(0, gridSize - 7);

    for (let row = 0; row < gridSize; row += 1) {
        for (let column = 0; column < gridSize; column += 1) {
            const inFinder = (column < 7 && row < 7)
                || (column >= gridSize - 7 && row < 7)
                || (column < 7 && row >= gridSize - 7);
            if (inFinder) {
                continue;
            }

            hash ^= (row * 31) + (column * 17);
            hash = Math.imul(hash, 1103515245) + 12345;

            if (((hash >>> 16) & 1) === 1) {
                fillModule(column, row);
            }
        }
    }
}

function getCombinationLabel(payload) {
    return normalizeText(
        [payload.reportHeader.qualification, payload.reportHeader.trade]
            .map((value) => `${value || ""}`.trim())
            .filter(Boolean)
            .join(" / ") || payload.studentProfile.tradeSection,
        "N/A"
    );
}

function buildCamisSubjectRows(payload) {
    const rows = payload.subjectResults.length > 0
        ? payload.subjectResults
        : [calculateSubjectMetrics({ subjectName: "No subjects entered", eu: 0, et: 0, maxMarks: 100 })];

    const subjectRows = rows.map((subject) => {
        const maximumEu = roundToOne(subject.maxMarks / 2);
        const maximumEt = roundToOne(subject.maxMarks / 2);

        return {
            subject: subject.subjectName,
            moduleType: normalizeModuleSection(subject.moduleType),
            maximumEu,
            maximumEt,
            maximumTot: roundToOne(subject.maxMarks),
            termEu: subject.eu > 0 ? formatMark(subject.eu, "-") : "-",
            termEt: subject.et > 0 ? formatMark(subject.et, "-") : "-",
            termTot: formatMark(subject.total),
            grade: subject.grade,
            totalTot: formatMark(subject.total),
            totalMax: formatMark(subject.maxMarks),
            totalPercent: formatMark(subject.percentage)
        };
    });

    const totals = {
        maximumEu: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.maximumEu), 0)),
        maximumEt: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.maximumEt), 0)),
        maximumTot: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.maximumTot), 0)),
        termEu: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.termEu), 0)),
        termEt: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.termEt), 0)),
        termTot: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.termTot), 0)),
        gradeValue: `${subjectRows.reduce((sum, row) => sum + getGradeValue(row.grade), 0)}`,
        totalTot: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.totalTot), 0)),
        totalMax: formatMark(subjectRows.reduce((sum, row) => sum + toNumber(row.totalMax), 0)),
        totalPercent: formatMark(payload.summary.percentage)
    };

    return {
        subjectRows,
        subjectGroups: MODULE_SECTIONS.map((section) => ({
            key: section.key,
            label: section.label,
            rows: subjectRows.filter((row) => row.moduleType === section.key)
        })),
        totals,
        termPercentage: formatMark(payload.summary.percentage)
    };
}

function drawCamisHeader(runtime, startY) {
    const { doc, payload } = runtime;
    const { reportHeader, studentProfile } = payload;
    const combinationLabel = getCombinationLabel(payload);
    const titleBoxText = /[A-Za-z]/.test(`${reportHeader.level || ""}`.trim())
        ? normalizeText(reportHeader.level, "")
        : "";
    const titleWidth = 175;
    const titleX = PAGE_MARGIN + ((CONTENT_WIDTH - titleWidth) / 2);
    const leftX = PAGE_MARGIN + 6;
    const leftWidth = 180;
    const logoWidth = normalizeLogoPdfDimension(reportHeader.logoWidth, 112, 60, 150);
    const logoHeight = normalizeLogoPdfDimension(reportHeader.logoLength, 64, 44, 110);
    const logoX = PAGE_MARGIN + ((CONTENT_WIDTH - logoWidth) / 2);
    const logoY = startY;
    const rightX = PAGE_MARGIN + CONTENT_WIDTH - 180;
    const rightWidth = 176;
    const topLinesY = startY + 8;
    const titleY = startY + Math.max(68, logoHeight + 12);
    const infoBoxY = titleY + 42;

    const drawLogo = () => {
        if (reportHeader.logoDataUrl) {
            try {
                doc.addImage(reportHeader.logoDataUrl, getDataUrlImageFormat(reportHeader.logoDataUrl) || "PNG", logoX, logoY, logoWidth, logoHeight);
                return;
            } catch (error) {
                console.error("School logo render failed:", error);
            }
        }

        doc.setFont("times", "italic");
        doc.setFontSize(8);
        doc.text("[SCHOOL LOGO HERE]", logoX + (logoWidth / 2), logoY + (logoHeight / 2) + 3, { align: "center" });
    };

    doc.setFont("times", "bold");
    doc.setFontSize(9.2);
    doc.text("REPUBLIC OF RWANDA", leftX, topLinesY);
    doc.text("MINISTRY OF EDUCATION", leftX, topLinesY + 14);
    doc.text("RWANDA TVET BOARD", leftX, topLinesY + 28);
    doc.text(normalizeText(reportHeader.district, "DISTRICT").toUpperCase(), leftX, topLinesY + 42);
    doc.text(normalizeText(reportHeader.schoolName || payload.schoolName, "SCHOOL").toUpperCase(), leftX, topLinesY + 56);

    doc.setFont("times", "bold");
    drawCellText(doc, `TRAINEE'S NAME: ${normalizeText(reportHeader.traineeName || studentProfile.name)}`, rightX, topLinesY - 6, rightWidth, 12, {
        fontStyle: "bold",
        fontSize: 9,
        padding: 0,
        shrinkToFit: true,
        minFontSize: 6.2
    });
    drawCellText(doc, `TRAINEE CODE: ${normalizeText(reportHeader.traineeCode || studentProfile.admissionNumber)}`, rightX, topLinesY + 8, rightWidth, 12, {
        fontStyle: "bold",
        fontSize: 9,
        padding: 0,
        shrinkToFit: true,
        minFontSize: 6.6
    });
    drawCellText(doc, `CLASS: ${normalizeText(reportHeader.className || studentProfile.className)}`, rightX, topLinesY + 22, rightWidth, 12, {
        fontStyle: "bold",
        fontSize: 9,
        padding: 0,
        shrinkToFit: true,
        minFontSize: 6.6
    });
    drawCellText(doc, `ACADEMIC YEAR: ${normalizeText(reportHeader.academicYear || payload.academicYear)}`, rightX, topLinesY + 36, rightWidth, 12, {
        fontStyle: "bold",
        fontSize: 9,
        padding: 0,
        shrinkToFit: true,
        minFontSize: 6.6
    });

    drawLogo();

    doc.rect(titleX, titleY, titleWidth, 34);
    if (titleBoxText) {
        drawCellText(doc, titleBoxText, titleX, titleY + 7, titleWidth, 20, {
            align: "center",
            fontStyle: "bold",
            fontSize: 10.4,
            shrinkToFit: true,
            minFontSize: 7.2
        });
    }

    doc.rect(PAGE_MARGIN, infoBoxY, CONTENT_WIDTH, 34);
    doc.setFontSize(9);
    drawCellText(doc, `Name: ${normalizeText(reportHeader.traineeName || studentProfile.name)}`, PAGE_MARGIN + 4, infoBoxY + 2, 250, 12, { fontStyle: "bold" });
    drawCellText(doc, `Reg No: ${normalizeText(reportHeader.traineeCode || studentProfile.admissionNumber)}`, PAGE_MARGIN + 4, infoBoxY + 16, 250, 12, { fontStyle: "bold" });
    drawCellText(doc, `Academic Year: ${normalizeText(reportHeader.academicYear || payload.academicYear)}`, PAGE_MARGIN + 280, infoBoxY + 2, CONTENT_WIDTH - 284, 9, { align: "right", fontStyle: "bold" });
    drawCellText(doc, `Combination: ${combinationLabel}`, PAGE_MARGIN + 280, infoBoxY + 12, CONTENT_WIDTH - 284, 9, { align: "right", fontStyle: "bold" });
    drawCellText(doc, `Class: ${normalizeText(reportHeader.className || studentProfile.className)}`, PAGE_MARGIN + 280, infoBoxY + 22, CONTENT_WIDTH - 284, 9, { align: "right", fontStyle: "bold" });

    return infoBoxY + 42;
}

function drawCamisMarksTable(runtime, startY) {
    const { doc, payload } = runtime;
    const { subjectGroups, totals, termPercentage } = buildCamisSubjectRows(payload);
    const x = PAGE_MARGIN + 4;
    const widths = [158, 34, 34, 42, 34, 34, 42, 28, 42, 42, 32];
    const subjectWidth = widths[0];
    const maxGroupWidth = widths[1] + widths[2] + widths[3];
    const termGroupWidth = widths[4] + widths[5] + widths[6] + widths[7];
    const totalGroupWidth = widths[8] + widths[9] + widths[10];
    const tableWidth = subjectWidth + maxGroupWidth + termGroupWidth + totalGroupWidth;
    let y = startY;

    drawRectCell(doc, x, y, subjectWidth, 30, "SUBJECT", { fontStyle: "bold", fontSize: 9 });
    drawCellText(doc, "WEIGHT", x, y + 14, subjectWidth, 14, { fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth, y, maxGroupWidth, 15, "MAXIMUM", { align: "center", fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth, y, termGroupWidth, 15, `${normalizeText(payload.term, "Term")} ${payload.academicYear}`, { align: "center", fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth + termGroupWidth, y, totalGroupWidth, 15, "Total", { align: "center", fontStyle: "bold", fontSize: 8 });

    let columnX = x + subjectWidth;
    [["EU", "50%"], ["ET", "50%"], ["TOT", "100%"], ["EU", "50%"], ["ET", "50%"], ["TOT", "100%"], ["GR", ""], ["TOT", ""], ["MAX", ""], ["%", ""]]
        .forEach(([label, subLabel], index) => {
            const width = widths[index + 1];
            const cellX = columnX;
            const cellY = y + 15;
            doc.rect(cellX, cellY, width, 15);
            drawCellText(doc, label, cellX, cellY - 2, width, 9, { align: "center", fontStyle: "bold", fontSize: 7.5 });
            if (subLabel) {
                drawCellText(doc, subLabel, cellX, cellY + 4, width, 9, { align: "center", fontStyle: "bold", fontSize: 7 });
            }
            columnX += width;
        });

    y += 30;
    drawRectCell(doc, x, y, subjectWidth, 16, "Conduct", { fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth, y, tableWidth - subjectWidth, 16, "", { fontSize: 8 });
    y += 16;

    drawRectCell(doc, x, y, tableWidth, 14, "All Subjects", { fontStyle: "bold", fontSize: 8 });
    y += 14;

    subjectGroups.forEach((group) => {
        drawRectCell(doc, x, y, tableWidth, 14, group.label, { fontStyle: "bold", fontSize: 7.8 });
        y += 14;

        if (group.rows.length === 0) {
            drawRectCell(doc, x, y, tableWidth, 14, "", { fontSize: 7.2 });
            y += 14;
            return;
        }

        group.rows.forEach((row) => {
            let rowX = x;
            const values = [
                row.subject,
                formatMark(row.maximumEu),
                formatMark(row.maximumEt),
                formatMark(row.maximumTot),
                row.termEu,
                row.termEt,
                row.termTot,
                row.grade,
                row.totalTot,
                row.totalMax,
                row.totalPercent
            ];
            widths.forEach((width, index) => {
                doc.rect(rowX, y, width, 16);
                drawCellText(doc, values[index], rowX, y, width, 16, {
                    align: index === 0 ? "left" : "center",
                    fontStyle: index === 0 ? "normal" : "bold",
                    fontSize: 7.2,
                    padding: 3,
                    maxLines: 1,
                    shrinkToFit: index === 0,
                    minFontSize: 5.6
                });
                rowX += width;
            });
            y += 16;
        });
    });

    let totalX = x;
    const totalValues = ["Total", totals.maximumEu, totals.maximumEt, totals.maximumTot, totals.termEu, totals.termEt, totals.termTot, totals.gradeValue, totals.totalTot, totals.totalMax, totals.totalPercent];
    widths.forEach((width, index) => {
        doc.rect(totalX, y, width, 18);
        drawCellText(doc, totalValues[index], totalX, y, width, 18, {
            align: index === 0 ? "left" : "center",
            fontStyle: "bold",
            fontSize: 8
        });
        totalX += width;
    });
    y += 18;

    drawRectCell(doc, x, y, subjectWidth + maxGroupWidth, 16, "Percentage", { fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth, y, termGroupWidth, 16, "", { align: "center", fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth + termGroupWidth, y, totalGroupWidth, 16, "", { align: "center", fontStyle: "bold", fontSize: 8 });
    doc.setTextColor(178, 0, 0);
    drawCellText(doc, `${termPercentage}%`, x + subjectWidth + maxGroupWidth, y, termGroupWidth, 16, { align: "center", fontStyle: "bold", fontSize: 8 });
    drawCellText(doc, `${totals.totalPercent}%`, x + subjectWidth + maxGroupWidth + termGroupWidth, y, totalGroupWidth, 16, { align: "center", fontStyle: "bold", fontSize: 8 });
    doc.setTextColor(0, 0, 0);
    y += 16;

    drawRectCell(doc, x, y, subjectWidth + maxGroupWidth, 16, "Position", { fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth, y, termGroupWidth, 16, payload.summary.position, { align: "center", fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth + termGroupWidth, y, totalGroupWidth, 16, payload.summary.position, { align: "center", fontStyle: "bold", fontSize: 8 });
    y += 16;

    drawRectCell(doc, x, y, subjectWidth + maxGroupWidth, 22, "Comment", { fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth, y, termGroupWidth, 22, normalizeOptionalText(payload.comments.teacherComments), { fontSize: 7.5, maxLines: 2 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth + termGroupWidth, y, totalGroupWidth, 22, normalizeOptionalText(payload.comments.headTeacherComments), { fontSize: 7.5, maxLines: 2 });
    y += 22;

    drawRectCell(doc, x, y, subjectWidth + maxGroupWidth, 20, "Class teacher's Signature", { fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth, y, termGroupWidth + totalGroupWidth, 20, "", { fontSize: 8 });
    y += 20;

    drawRectCell(doc, x, y, subjectWidth + maxGroupWidth, 20, "Parent's Signature", { fontStyle: "bold", fontSize: 8 });
    drawRectCell(doc, x + subjectWidth + maxGroupWidth, y, termGroupWidth + totalGroupWidth, 20, "", { fontSize: 8 });

    return y + 28;
}

function drawCamisGradingScale(runtime, startY) {
    const { doc } = runtime;
    const x = PAGE_MARGIN + 4;
    const widths = [95, 72, 51, 51, 51, 51, 51, 51, 51];
    const rowHeight = 18;
    let y = startY;

    drawRectCell(doc, x, y, widths[0], rowHeight * 3, "Grading scale", { fontStyle: "bold", fontSize: 9 });

    const headers = ["Percentage", "100-70", "69-65", "64-60", "59-50", "49-40", "39-20", "19-00"];
    const letterGrades = ["Letter Grade", "A", "B", "C", "D", "E", "S", "F"];
    const gradeValues = ["Grade Value", "6", "5", "4", "3", "2", "1", "0"];

    [headers, letterGrades, gradeValues].forEach((row, rowIndex) => {
        let rowX = x + widths[0];
        row.forEach((value, index) => {
            const width = widths[index + 1];
            doc.rect(rowX, y + (rowIndex * rowHeight), width, rowHeight);
            drawCellText(doc, value, rowX, y + (rowIndex * rowHeight), width, rowHeight, {
                align: "center",
                fontStyle: rowIndex === 0 || index === 0 ? "bold" : "normal",
                fontSize: 7.5
            });
            rowX += width;
        });
    });

    return y + (rowHeight * 3) + 10;
}

function drawCamisDecisions(runtime, startY) {
    const { doc, payload } = runtime;
    const x = PAGE_MARGIN + 4;
    const leftWidth = 440;
    const qrSize = 78;
    const rowHeight = 16;
    const sectionHeight = 84;
    const qrX = x + leftWidth + 16;
    const qrY = startY + 6;

    doc.rect(x, startY, leftWidth, sectionHeight);
    drawCellText(doc, "First Decision", x, startY, 105, rowHeight, { fontStyle: "bold", fontSize: 9 });
    drawCellText(doc, "Final Decision", x + 105, startY, 105, rowHeight, { fontStyle: "bold", fontSize: 9 });
    drawCellText(doc, "Abbreviations", x + 210, startY, 140, rowHeight, { fontStyle: "bold", fontSize: 9 });
    drawCellText(doc, "HEADTEACHER", x + 350, startY, 90, rowHeight, { fontStyle: "bold", fontSize: 9 });
    drawCellText(doc, "Signature", x + 410, startY, 30, rowHeight, { fontStyle: "bold", fontSize: 8 });

    const firstDecision = ["Promoted", "2nd Sitting", "Discontinued"];
    const finalDecision = ["Promoted", "2nd Sitting", "Discontinued"];
    const abbreviations = ["EU : End of Unit", "ET : End of Term", "GR : Letter grade", "TOT : Total", "MAX : Maximum marks"];

    firstDecision.forEach((line, index) => {
        drawCellText(doc, line, x + 4, startY + 18 + (index * 12), 96, 12, { fontSize: 8 });
    });
    finalDecision.forEach((line, index) => {
        drawCellText(doc, line, x + 109, startY + 18 + (index * 12), 96, 12, { fontSize: 8 });
    });
    abbreviations.forEach((line, index) => {
        drawCellText(doc, line, x + 214, startY + 18 + (index * 12), 132, 12, { fontSize: 8 });
    });

    doc.line(x + 395, startY + 54, x + 438, startY + 54);

    drawPseudoQr(doc, qrX, qrY, qrSize, `${payload.studentProfile.name}|${payload.summary.totalMarks}|${payload.summary.percentage}`);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.text("Generated by CAMIS", qrX + (qrSize / 2), qrY + qrSize + 12, { align: "center" });

    return startY + sectionHeight;
}

export function generateCamisReportCardPdf(payload) {
    const normalizedPayload = normalizeCamisPayload(payload);
    const runtime = createRuntime(normalizedPayload);
    let cursorY = addPage(runtime);

    cursorY = drawCamisHeader(runtime, cursorY);
    cursorY = drawCamisMarksTable(runtime, cursorY);
    cursorY = drawCamisGradingScale(runtime, cursorY);
    drawCamisDecisions(runtime, cursorY);

    const fileName = `${sanitizeFileSegment(normalizedPayload.studentProfile.name)}-${sanitizeFileSegment(normalizedPayload.term)}-camis-report-card.pdf`;
    runtime.doc.save(fileName);
    return fileName;
}

export function generateReportCardPdf(payload) {
    return generateCamisReportCardPdf(payload);
}
