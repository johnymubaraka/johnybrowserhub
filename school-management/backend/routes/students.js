function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStudentPayload(payload = {}) {
    return {
        name: `${payload.name || ""}`.trim(),
        className: `${payload.className || payload.class || ""}`.trim(),
        admissionNumber: `${payload.admissionNumber || ""}`.trim(),
        gender: `${payload.gender || ""}`.trim(),
        dob: `${payload.dob || ""}`.trim(),
        tradeSection: `${payload.tradeSection || payload.trade || payload.section || ""}`.trim()
    };
}

async function handleStudentsRoute(context) {
    const { pathname, request, response, body, store, sendJson } = context;

    if (pathname !== "/api/students") {
        return false;
    }

    if (request.method === "GET") {
        sendJson(response, 200, {
            success: true,
            students: store.getStudents()
        });
        return true;
    }

    if (request.method === "POST") {
        const student = normalizeStudentPayload(body);

        if (!student.name || !student.className) {
            sendJson(response, 400, {
                success: false,
                error: "Student name and class are required."
            });
            return true;
        }

        const students = store.getStudents();
        const savedStudent = {
            id: createId("student"),
            ...student,
            createdAt: new Date().toISOString()
        };

        students.unshift(savedStudent);
        store.saveStudents(students);

        sendJson(response, 201, {
            success: true,
            student: savedStudent
        });
        return true;
    }

    sendJson(response, 405, {
        success: false,
        error: "Method not allowed."
    });
    return true;
}

module.exports = {
    handleStudentsRoute
};
