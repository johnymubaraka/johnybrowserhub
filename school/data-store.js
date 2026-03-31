import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { sortByCreatedAtDescending } from "./shared.js";

const SCHOOL_COLLECTIONS = [
    "schoolSettings",
    "users",
    "students",
    "classes",
    "teachers",
    "modules",
    "assignments",
    "marks",
    "moduleMarks",
    "reports"
];

function createDefaultCache() {
    return {
        schoolSettings: [],
        users: [],
        students: [],
        classes: [],
        teachers: [],
        modules: [],
        assignments: [],
        marks: [],
        moduleMarks: [],
        reports: []
    };
}

export function createSchoolDataStore({ db, schoolId, onStatusChange }) {
    const cache = createDefaultCache();
    const subscribers = new Map(SCHOOL_COLLECTIONS.map((collectionName) => [collectionName, new Set()]));
    let started = false;
    let unsubscribeHandlers = [];

    function emit(collectionName) {
        const listeners = subscribers.get(collectionName);
        if (!listeners) {
            return;
        }

        const items = [...cache[collectionName]];
        listeners.forEach((listener) => {
            listener(items);
        });
    }

    function subscribe(collectionName, listener) {
        const listeners = subscribers.get(collectionName);
        if (!listeners) {
            throw new Error(`Unknown school collection: ${collectionName}`);
        }

        listeners.add(listener);
        listener([...cache[collectionName]]);

        return () => {
            listeners.delete(listener);
        };
    }

    function getItems(collectionName) {
        return [...(cache[collectionName] || [])];
    }

    async function addRecord(collectionName, payload) {
        const documentRef = await addDoc(collection(db, collectionName), {
            schoolId,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return documentRef.id;
    }

    async function updateRecord(collectionName, id, payload) {
        await updateDoc(doc(db, collectionName, id), {
            ...payload,
            updatedAt: serverTimestamp()
        });
    }

    function startCollectionListener(collectionName) {
        return new Promise((resolve) => {
            let settled = false;

            const unsubscribe = onSnapshot(
                query(collection(db, collectionName), where("schoolId", "==", schoolId)),
                (snapshot) => {
                    cache[collectionName] = sortByCreatedAtDescending(snapshot.docs.map((documentSnapshot) => ({
                        id: documentSnapshot.id,
                        ...documentSnapshot.data()
                    })));
                    emit(collectionName);

                    if (!settled) {
                        settled = true;
                        resolve(cache[collectionName]);
                    }
                },
                (error) => {
                    console.error(`School ${collectionName} listener failed:`, error);
                    onStatusChange?.(`Live Firebase sync failed for ${collectionName}.`, "error");

                    if (!settled) {
                        settled = true;
                        resolve(cache[collectionName]);
                    }
                }
            );

            unsubscribeHandlers.push(unsubscribe);
        });
    }

    async function start() {
        if (started) {
            return SCHOOL_COLLECTIONS.map((collectionName) => getItems(collectionName));
        }

        started = true;
        return Promise.all(SCHOOL_COLLECTIONS.map((collectionName) => startCollectionListener(collectionName)));
    }

    function destroy() {
        unsubscribeHandlers.forEach((unsubscribe) => unsubscribe());
        unsubscribeHandlers = [];
        started = false;
    }

    return {
        start,
        destroy,
        subscribe,
        getItems,
        addStudent(payload) {
            return addRecord("students", payload);
        },
        updateStudent(id, payload) {
            return updateRecord("students", id, payload);
        },
        addSchoolSetting(payload) {
            return addRecord("schoolSettings", payload);
        },
        updateSchoolSetting(id, payload) {
            return updateRecord("schoolSettings", id, payload);
        },
        addUser(payload) {
            return addRecord("users", payload);
        },
        updateUser(id, payload) {
            return updateRecord("users", id, payload);
        },
        addClass(payload) {
            return addRecord("classes", payload);
        },
        addTeacher(payload) {
            return addRecord("teachers", payload);
        },
        updateTeacher(id, payload) {
            return updateRecord("teachers", id, payload);
        },
        addModule(payload) {
            return addRecord("modules", payload);
        },
        updateModule(id, payload) {
            return updateRecord("modules", id, payload);
        },
        addAssignment(payload) {
            return addRecord("assignments", payload);
        },
        updateAssignment(id, payload) {
            return updateRecord("assignments", id, payload);
        },
        addMark(payload) {
            return addRecord("marks", payload);
        },
        updateMark(id, payload) {
            return updateRecord("marks", id, payload);
        },
        addModuleMark(payload) {
            return addRecord("moduleMarks", payload);
        },
        updateModuleMark(id, payload) {
            return updateRecord("moduleMarks", id, payload);
        },
        addReport(payload) {
            return addRecord("reports", payload);
        },
        updateReport(id, payload) {
            return updateRecord("reports", id, payload);
        }
    };
}
