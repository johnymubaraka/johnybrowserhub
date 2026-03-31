export function getTimestampValue(value) {
    if (!value) {
        return 0;
    }

    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }

    if (typeof value.seconds === "number") {
        return value.seconds * 1000;
    }

    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}

export function sortByCreatedAtDescending(items) {
    return [...items].sort((left, right) => getTimestampValue(right.createdAt) - getTimestampValue(left.createdAt));
}

export function formatDisplayDate(value) {
    const timestamp = getTimestampValue(value);

    if (!timestamp) {
        return "Just now";
    }

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium"
    }).format(new Date(timestamp));
}

export function joinMeta(parts, fallback = "Record") {
    const result = parts
        .map((part) => `${part || ""}`.trim())
        .filter(Boolean)
        .join(" • ");

    return result || fallback;
}

export function createPill(label, tone = "default") {
    const span = document.createElement("span");
    span.className = `school-pill${tone !== "default" ? ` is-${tone}` : ""}`;
    span.textContent = label;
    return span;
}

export function parseSubjectScores(rawValue) {
    return `${rawValue || ""}`
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const colonIndex = line.indexOf(":");
            const separatorIndex = colonIndex >= 0 ? colonIndex : line.indexOf("-");
            const subject = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
            const scoreText = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : "";
            const numericValue = Number.parseFloat(scoreText);

            return {
                subject: subject || "Subject",
                score: Number.isFinite(numericValue) ? numericValue : null,
                scoreText: scoreText || "N/A"
            };
        });
}

export function calculateAverageScore(subjectScores) {
    const numericScores = (Array.isArray(subjectScores) ? subjectScores : [])
        .map((item) => item?.score)
        .filter((score) => Number.isFinite(score));

    if (numericScores.length === 0) {
        return null;
    }

    const total = numericScores.reduce((sum, score) => sum + score, 0);
    return Math.round((total / numericScores.length) * 10) / 10;
}

export function getGradeLabel(score) {
    if (!Number.isFinite(score)) {
        return "N/A";
    }

    if (score >= 90) {
        return "A";
    }

    if (score >= 80) {
        return "B";
    }

    if (score >= 70) {
        return "C";
    }

    if (score >= 60) {
        return "D";
    }

    return "F";
}

export function sanitizeFileSegment(value) {
    return `${value || ""}`
        .trim()
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "report-card";
}

export async function withAppServiceLoading(message, callback) {
    const loader = window?.johnyBrowserHubServiceLoading?.withLoading;

    if (typeof loader === "function") {
        return loader(message, callback);
    }

    return callback();
}
