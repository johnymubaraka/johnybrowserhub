function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value) {
    const numericValue = Number.parseFloat(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundToOne(value) {
    return Math.round(value * 10) / 10;
}

function calculateGrade(percentage) {
    if (percentage >= 80) {
        return "A";
    }
    if (percentage >= 70) {
        return "B";
    }
    if (percentage >= 60) {
        return "C";
    }
    if (percentage >= 50) {
        return "D";
    }
    if (percentage >= 40) {
        return "E";
    }
    return "F";
}

function normalizeSubjectRows(subjects = []) {
    return (Array.isArray(subjects) ? subjects : [])
        .map((subject) => {
            const maxMarks = Math.max(toNumber(subject.max || subject.maxMarks), 1);
            const el = toNumber(subject.el);
            const et = toNumber(subject.et);
            const total = roundToOne(el + et);
            const percentage = roundToOne((total / maxMarks) * 100);

            return {
                subjectName: `${subject.subjectName || ""}`.trim(),
                maxMarks,
                el: roundToOne(el),
                et: roundToOne(et),
                total,
                percentage,
                grade: calculateGrade(percentage)
            };
        })
        .filter((subject) => subject.subjectName);
}

function buildSavedReport(body, student) {
    const subjects = normalizeSubjectRows(body.subjects);
    const totalMarks = roundToOne(subjects.reduce((sum, subject) => sum + subject.total, 0));
    const maxMarks = roundToOne(subjects.reduce((sum, subject) => sum + subject.maxMarks, 0));
    const percentage = maxMarks > 0 ? roundToOne((totalMarks / maxMarks) * 100) : 0;

    return {
        id: `${body.reportId || createId("report")}`.trim(),
        reportTitle: `${body.reportTitle || "Student Report Card"}`.trim(),
        schoolName: `${body.schoolName || "JohnyBrowserHub Pro School"}`.trim(),
        academicYear: `${body.academicYear || new Date().getFullYear()}`.trim(),
        term: `${body.term || "Term I"}`.trim(),
        position: `${body.position || "N/A"}`.trim(),
        studentId: student.id,
        studentName: student.name,
        admissionNumber: student.admissionNumber || "",
        className: student.className,
        gender: student.gender || "",
        dob: student.dob || "",
        tradeSection: student.tradeSection || "",
        subjects,
        totalMarks,
        maxMarks,
        percentage,
        overallGrade: calculateGrade(percentage),
        behaviorRemarks: `${body.behaviorRemarks || ""}`.trim(),
        disciplineScore: `${body.disciplineScore || ""}`.trim(),
        teacherComments: `${body.teacherComments || ""}`.trim(),
        headTeacherComments: `${body.headTeacherComments || ""}`.trim(),
        parentComments: `${body.parentComments || ""}`.trim(),
        signatures: {
            classTeacher: `${body.classTeacherSignature || "Class Teacher"}`.trim(),
            headTeacher: `${body.headTeacherSignature || "Head Teacher"}`.trim(),
            parentGuardian: `${body.parentSignature || "Parent / Guardian"}`.trim()
        },
        updatedAt: new Date().toISOString(),
        createdAt: `${body.createdAt || new Date().toISOString()}`
    };
}

function toPdfPayload(report) {
    return {
        schoolName: report.schoolName,
        reportTitle: report.reportTitle,
        academicYear: report.academicYear,
        term: report.term,
        studentProfile: {
            name: report.studentName,
            admissionNumber: report.admissionNumber,
            class: report.className,
            gender: report.gender,
            dob: report.dob,
            "trade/section": report.tradeSection
        },
        academicResults: report.subjects.map((subject) => ({
            subjectName: subject.subjectName,
            max: subject.maxMarks,
            el: subject.el,
            et: subject.et,
            total: subject.total,
            grade: subject.grade
        })),
        totals: {
            totalMarks: report.totalMarks,
            maxMarks: report.maxMarks,
            percentage: report.percentage,
            position: report.position
        },
        conduct: {
            behaviorRemarks: report.behaviorRemarks,
            disciplineScore: report.disciplineScore
        },
        comments: {
            teacherComments: report.teacherComments,
            headTeacherComments: report.headTeacherComments,
            parentComments: report.parentComments
        },
        signatures: report.signatures
    };
}

async function handleResultsRoute(context) {
    const {
        pathname,
        request,
        response,
        query,
        body,
        store,
        sendJson,
        frontendBaseUrl,
        generatedDir,
        generateReportCardPdf
    } = context;

    if (pathname === "/api/results" && request.method === "GET") {
        const studentId = `${query.get("studentId") || ""}`.trim();
        const reports = store.getResults().filter((report) => !studentId || report.studentId === studentId);
        sendJson(response, 200, {
            success: true,
            reports
        });
        return true;
    }

    if (pathname === "/api/results" && request.method === "POST") {
        const studentId = `${body.studentId || ""}`.trim();
        const student = store.getStudentById(studentId);

        if (!student) {
            sendJson(response, 404, {
                success: false,
                error: "Selected student could not be found."
            });
            return true;
        }

        const report = buildSavedReport(body, student);
        if (report.subjects.length === 0) {
            sendJson(response, 400, {
                success: false,
                error: "Add at least one subject mark before saving."
            });
            return true;
        }

        const reports = store.getResults();
        const existingIndex = reports.findIndex((item) => item.id === report.id);

        if (existingIndex >= 0) {
            reports[existingIndex] = {
                ...reports[existingIndex],
                ...report
            };
        } else {
            reports.unshift(report);
        }

        store.saveResults(reports);
        sendJson(response, 200, {
            success: true,
            report
        });
        return true;
    }

    const pdfMatch = pathname.match(/^\/api\/results\/([^/]+)\/pdf$/);
    if (pdfMatch && request.method === "POST") {
        const reportId = decodeURIComponent(pdfMatch[1]);
        const report = store.getResults().find((item) => item.id === reportId);

        if (!report) {
            sendJson(response, 404, {
                success: false,
                error: "Report card record not found."
            });
            return true;
        }

        const pdfResult = await generateReportCardPdf({
            reportData: toPdfPayload(report),
            outputDir: generatedDir
        });

        sendJson(response, 200, {
            success: true,
            fileName: pdfResult.fileName,
            filePath: pdfResult.filePath,
            downloadUrl: `${frontendBaseUrl}/generated-reports/${encodeURIComponent(pdfResult.fileName)}`
        });
        return true;
    }

    return false;
}

module.exports = {
    handleResultsRoute
};
