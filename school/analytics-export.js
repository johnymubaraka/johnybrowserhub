import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";
import { sanitizeFileSegment } from "./shared.js";

const PAGE_MARGIN = 36;
const FOOTER_MARGIN = 110;

function normalizeText(value, fallback = "-") {
    const text = `${value ?? ""}`.trim();
    return text || fallback;
}

function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium"
    }).format(date);
}

function getGrade(percentage) {
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

function toCsvCell(value) {
    const text = `${value ?? ""}`.replace(/"/g, "\"\"");
    return `"${text}"`;
}

function downloadBlob(fileName, blob) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

function drawHeader(doc, payload, pageNumber) {
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = PAGE_MARGIN;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(pageNumber === 1 ? 20 : 16);
    doc.text(pageNumber === 1 ? "ANALYTICS PERFORMANCE LIST" : "ANALYTICS RESULTS", pageWidth / 2, y, { align: "center" });
    y += pageNumber === 1 ? 22 : 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`School: ${normalizeText(payload.schoolName, "School Management")}`, PAGE_MARGIN, y);
    doc.text(`Date: ${formatDate(payload.generatedAt)}`, pageWidth - PAGE_MARGIN, y, { align: "right" });
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Classes: ${normalizeText(payload.selectionLabel, "All classes")}`, PAGE_MARGIN, y);
    doc.text(`Hardest Subject: ${normalizeText(payload.hardestSubject?.label, "N/A")}`, pageWidth - PAGE_MARGIN, y, { align: "right" });
    y += 10;

    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.9);
    doc.line(PAGE_MARGIN, y + 4, pageWidth - PAGE_MARGIN, y + 4);

    return y + 18;
}

function drawMetricBoxes(doc, startY, totals) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const gap = 10;
    const boxWidth = (pageWidth - (PAGE_MARGIN * 2) - (gap * 3)) / 4;
    const boxHeight = 58;
    const metrics = [
        ["Total Students", `${totals.totalStudents}`],
        ["Total Classes", `${totals.totalClasses}`],
        ["Total Teachers", `${totals.totalTeachers}`],
        ["Total Modules", `${totals.totalModules}`]
    ];

    metrics.forEach(([label, value], index) => {
        const x = PAGE_MARGIN + (index * (boxWidth + gap));
        doc.rect(x, startY, boxWidth, boxHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(label.toUpperCase(), x + 8, startY + 16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(value, x + 8, startY + 41);
    });

    return startY + boxHeight + 18;
}

function drawTable(doc, startY, config, payload, pageRef) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headers = Array.isArray(config.headers) ? config.headers : [];
    const rows = Array.isArray(config.rows) ? config.rows : [];
    const widths = Array.isArray(config.widths) ? config.widths : [];
    let y = startY;

    const drawSectionHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(config.title, PAGE_MARGIN, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(config.subtitle, PAGE_MARGIN, y + 8);
        y += 20;

        let cellX = PAGE_MARGIN;
        headers.forEach((header, index) => {
            const width = widths[index];
            doc.setFillColor(243, 243, 243);
            doc.rect(cellX, y, width, 24, "FD");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.text(header, cellX + 5, y + 15);
            cellX += width;
        });
        y += 24;
    };

    const addPage = () => {
        doc.addPage();
        pageRef.value += 1;
        y = drawHeader(doc, payload, pageRef.value);
        drawSectionHeader();
    };

    if (y + 52 > pageHeight - FOOTER_MARGIN) {
        doc.addPage();
        pageRef.value += 1;
        y = drawHeader(doc, payload, pageRef.value);
    }

    drawSectionHeader();

    if (rows.length === 0) {
        if (y + 28 > pageHeight - FOOTER_MARGIN) {
            addPage();
        }
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.text("No analytics records are available for this section yet.", PAGE_MARGIN, y + 14);
        return y + 28;
    }

    rows.forEach((row) => {
        const cellLines = row.map((cell, index) => doc.splitTextToSize(normalizeText(cell), Math.max(widths[index] - 10, 24)));
        const rowHeight = Math.max(...cellLines.map((lines) => Math.max(lines.length, 1))) * 10 + 10;

        if (y + rowHeight > pageHeight - FOOTER_MARGIN) {
            addPage();
        }

        let cellX = PAGE_MARGIN;
        cellLines.forEach((lines, index) => {
            const width = widths[index];
            doc.rect(cellX, y, width, rowHeight);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.7);
            doc.text(lines, cellX + 5, y + 13);
            cellX += width;
        });
        y += rowHeight;
    });

    return y + 16;
}

function drawFooter(doc, payload, pageNumber, pageCount) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const lineY = pageHeight - 74;

    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.6);
    doc.line(PAGE_MARGIN, lineY, PAGE_MARGIN + 150, lineY);
    doc.line(pageWidth - PAGE_MARGIN - 150, lineY, pageWidth - PAGE_MARGIN, lineY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("DOS Signature", PAGE_MARGIN, lineY + 14);
    doc.text("Analytics Export", pageWidth - PAGE_MARGIN - 150, lineY + 14);
    doc.text(`Generated via JohnyBrowserHub School Analytics • ${normalizeText(payload.schoolName, "School Management")}`, pageWidth / 2, pageHeight - 24, { align: "center" });
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 24, { align: "right" });
}

function applyFooters(doc, payload) {
    const pageCount = doc.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        doc.setPage(pageNumber);
        drawFooter(doc, payload, pageNumber, pageCount);
    }
}

export function generateAnalyticsResultsPdf(payload = {}) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
    });
    const pageRef = {
        value: 1
    };

    let cursorY = drawHeader(doc, payload, pageRef.value);
    cursorY = drawMetricBoxes(doc, cursorY, payload.totals || {});

    cursorY = drawTable(doc, cursorY, {
        title: "CLASS PERFORMANCE SUMMARY",
        subtitle: "Average percentage by class from stored marks.",
        headers: ["Class", "Trade / Level", "Average (%)"],
        widths: [230, 190, 103],
        rows: (payload.classPerformance || []).map((item) => [
            item.label,
            item.meta || item.detail || "-",
            `${Number.parseFloat(item.value || 0).toFixed(1)}`
        ])
    }, payload, pageRef);

    cursorY = drawTable(doc, cursorY, {
        title: "MODULE PERFORMANCE SUMMARY",
        subtitle: "Average percentage by module from stored marks.",
        headers: ["Module", "Category", "Average (%)"],
        widths: [260, 160, 103],
        rows: (payload.modulePerformance || []).map((item) => [
            item.label,
            item.meta || "-",
            `${Number.parseFloat(item.value || 0).toFixed(1)}`
        ])
    }, payload, pageRef);

    cursorY = drawTable(doc, cursorY, {
        title: "TOP STUDENT RANKINGS",
        subtitle: "Top 5 students from reports sorted by total marks.",
        headers: ["Rank", "Student", "Class", "Total Marks", "Percentage"],
        widths: [56, 168, 150, 94, 55],
        rows: (payload.topStudents || []).map((item) => [
            `${item.rank || "-"}`,
            item.studentName,
            item.className,
            `${Number.parseFloat(item.totalMarks || 0).toFixed(1)}`,
            `${Number.parseFloat(item.percentage || 0).toFixed(1)}`
        ])
    }, payload, pageRef);

    cursorY = drawTable(doc, cursorY, {
        title: "STUDENT PERFORMANCE LIST",
        subtitle: "Analytics ranking list for the selected classes.",
        headers: ["Student Name", "Trade", "Level", "Marks (%)", "Grade"],
        widths: [178, 110, 74, 86, 75],
        rows: (payload.studentPerformance || []).map((item) => [
            item.studentName,
            item.trade,
            item.level,
            `${Number.parseFloat(item.percentage || 0).toFixed(1)}`,
            item.grade || getGrade(Number.parseFloat(item.percentage || 0))
        ])
    }, payload, pageRef);

    applyFooters(doc, payload);

    const fileName = `${sanitizeFileSegment(payload.schoolName || "school")}-analytics-results.pdf`;
    doc.save(fileName);
    return fileName;
}

export function downloadAnalyticsResultsCsv(payload = {}) {
    const rows = [
        ["School Analytics Results"],
        [`School`, payload.schoolName || "School Management"],
        [`Date`, formatDate(payload.generatedAt || new Date())],
        [`Classes`, payload.selectionLabel || "Selected classes"],
        [`Hardest Subject`, payload.hardestSubject?.label || "N/A"],
        [`Hardest Subject Average`, `${Number.parseFloat(payload.hardestSubject?.value || 0).toFixed(1)}%`],
        [],
        ["Overview"],
        ["Total Students", `${payload.totals?.totalStudents ?? 0}`],
        ["Total Classes", `${payload.totals?.totalClasses ?? 0}`],
        ["Total Teachers", `${payload.totals?.totalTeachers ?? 0}`],
        ["Total Modules", `${payload.totals?.totalModules ?? 0}`],
        [],
        ["Class Performance"],
        ["Class", "Trade / Level", "Average (%)"],
        ...(payload.classPerformance || []).map((item) => [item.label, item.meta || item.detail || "-", `${Number.parseFloat(item.value || 0).toFixed(1)}`]),
        [],
        ["Module Performance"],
        ["Module", "Category", "Average (%)"],
        ...(payload.modulePerformance || []).map((item) => [item.label, item.meta || "-", `${Number.parseFloat(item.value || 0).toFixed(1)}`]),
        [],
        ["Top Student Rankings"],
        ["Rank", "Student", "Class", "Total Marks", "Percentage", "Position"],
        ...(payload.topStudents || []).map((item) => [`${item.rank || "-"}`, item.studentName, item.className, `${Number.parseFloat(item.totalMarks || 0).toFixed(1)}`, `${Number.parseFloat(item.percentage || 0).toFixed(1)}`, item.position || "-"]),
        [],
        ["Student Performance List"],
        ["Student Name", "Trade", "Level", "Marks (%)", "Grade"],
        ...(payload.studentPerformance || []).map((item) => [item.studentName, item.trade, item.level, `${Number.parseFloat(item.percentage || 0).toFixed(1)}`, item.grade || getGrade(Number.parseFloat(item.percentage || 0))])
    ];

    const csv = rows
        .map((row) => row.map((cell) => toCsvCell(cell)).join(","))
        .join("\r\n");

    const fileName = `${sanitizeFileSegment(payload.schoolName || "school")}-analytics-results.csv`;
    downloadBlob(fileName, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    return fileName;
}
