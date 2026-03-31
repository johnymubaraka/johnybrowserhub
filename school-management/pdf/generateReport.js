const fs = require("fs");
const path = require("path");

const TEMPLATE_PATH = path.join(__dirname, "reportTemplate.html");

function escapeHtml(value) {
    return `${value ?? ""}`
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeValue(value, fallback = "N/A") {
    const text = `${value ?? ""}`.trim();
    return text || fallback;
}

function renderResultRows(academicResults = []) {
    const rows = Array.isArray(academicResults) ? academicResults : [];

    if (rows.length === 0) {
        return `
            <tr>
                <td>No subjects entered</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>N/A</td>
            </tr>
        `;
    }

    return rows.map((row) => `
        <tr>
            <td>${escapeHtml(normalizeValue(row.subjectName, "Subject"))}</td>
            <td>${escapeHtml(normalizeValue(row.max, "0"))}</td>
            <td>${escapeHtml(normalizeValue(row.el, "0"))}</td>
            <td>${escapeHtml(normalizeValue(row.et, "0"))}</td>
            <td>${escapeHtml(normalizeValue(row.total, "0"))}</td>
            <td>${escapeHtml(normalizeValue(row.grade, "N/A"))}</td>
        </tr>
    `).join("");
}

function renderTemplate(reportData) {
    const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
    const studentProfile = reportData.studentProfile || {};
    const conduct = reportData.conduct || {};
    const comments = reportData.comments || {};
    const signatures = reportData.signatures || {};
    const totals = reportData.totals || {};

    const replacements = {
        "{{GENERATED_DATE}}": new Date().toLocaleString(),
        "{{REPORT_TITLE}}": escapeHtml(normalizeValue(reportData.reportTitle, "STUDENT REPORT CARD")),
        "{{SCHOOL_NAME}}": escapeHtml(normalizeValue(reportData.schoolName, "JohnyBrowserHub Pro School")),
        "{{ACADEMIC_YEAR}}": escapeHtml(normalizeValue(reportData.academicYear, `${new Date().getFullYear()}`)),
        "{{TERM}}": escapeHtml(normalizeValue(reportData.term, "Term I")),
        "{{STUDENT_NAME}}": escapeHtml(normalizeValue(studentProfile.name, "Student not specified")),
        "{{ADMISSION_NUMBER}}": escapeHtml(normalizeValue(studentProfile.admissionNumber)),
        "{{CLASS_NAME}}": escapeHtml(normalizeValue(studentProfile.class || studentProfile.className)),
        "{{GENDER}}": escapeHtml(normalizeValue(studentProfile.gender)),
        "{{DOB}}": escapeHtml(normalizeValue(studentProfile.dob)),
        "{{TRADE_SECTION}}": escapeHtml(normalizeValue(studentProfile.tradeSection || studentProfile.trade || studentProfile.section || studentProfile["trade/section"])),
        "{{RESULT_ROWS}}": renderResultRows(reportData.academicResults),
        "{{TOTAL_MARKS}}": escapeHtml(normalizeValue(totals.totalMarks, "0")),
        "{{MAX_MARKS}}": escapeHtml(normalizeValue(totals.maxMarks, "0")),
        "{{PERCENTAGE}}": escapeHtml(normalizeValue(totals.percentage, "0")),
        "{{POSITION}}": escapeHtml(normalizeValue(totals.position)),
        "{{BEHAVIOR_REMARKS}}": escapeHtml(normalizeValue(conduct.behaviorRemarks)),
        "{{DISCIPLINE_SCORE}}": escapeHtml(normalizeValue(conduct.disciplineScore)),
        "{{TEACHER_COMMENTS}}": escapeHtml(normalizeValue(comments.teacherComments)),
        "{{HEAD_TEACHER_COMMENTS}}": escapeHtml(normalizeValue(comments.headTeacherComments)),
        "{{PARENT_COMMENTS}}": escapeHtml(normalizeValue(comments.parentComments)),
        "{{CLASS_TEACHER_SIGNATURE}}": escapeHtml(normalizeValue(signatures.classTeacher || signatures.teacherName, "Class Teacher")),
        "{{HEAD_TEACHER_SIGNATURE}}": escapeHtml(normalizeValue(signatures.headTeacher || signatures.headTeacherName, "Head Teacher")),
        "{{PARENT_SIGNATURE}}": escapeHtml(normalizeValue(signatures.parentGuardian || signatures.parentName, "Parent / Guardian"))
    };

    return Object.entries(replacements).reduce((html, [token, value]) => html.replaceAll(token, value), template);
}

async function generateReportCardPdf({ reportData, outputDir }) {
    let puppeteer;

    try {
        puppeteer = require("puppeteer");
    } catch (error) {
        throw new Error("Puppeteer is not installed. Install it with: npm install puppeteer");
    }

    if (!reportData) {
        throw new Error("reportData is required to generate a PDF.");
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const html = renderTemplate(reportData);
    const safeStudentName = `${reportData.studentProfile?.name || "student"}`
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, "-");
    const safeTerm = `${reportData.term || "term"}`.replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "-");
    const fileName = `${safeStudentName}-${safeTerm}-report-card.pdf`;
    const filePath = path.join(outputDir, fileName);

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        await page.pdf({
            path: filePath,
            format: "A4",
            printBackground: true,
            margin: {
                top: "8mm",
                right: "8mm",
                bottom: "8mm",
                left: "8mm"
            }
        });
    } finally {
        await browser.close();
    }

    return {
        fileName,
        filePath
    };
}

module.exports = {
    generateReportCardPdf
};
