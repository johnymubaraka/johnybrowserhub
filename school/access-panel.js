import { withAppServiceLoading } from "./shared.js";

export function createAccessController({ schoolStore, panel, onStatusChange }) {
    let form = null;
    let schoolNameInput = null;
    let accessCodeInput = null;
    let helperCopy = null;
    let currentSetting = null;
    let users = [];

    function syncResolvedSchoolName(schoolName = "") {
        const resolvedName = `${schoolName || currentSetting?.schoolName || ""}`.trim();
        if (!resolvedName) {
            return;
        }

        window.__JBNH_CURRENT_SCHOOL_RESOLVED_NAME__ = resolvedName;

        const schoolNameHeading = document.getElementById("school-name");
        if (schoolNameHeading) {
            schoolNameHeading.textContent = resolvedName;
        }
    }

    function renderShell() {
        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="school-panel-head">
                <div>
                    <p class="menu-section-kicker">DOS Access</p>
                    <h3 class="school-panel-title">School access code and onboarding</h3>
                    <p class="school-panel-copy">Set the DOS code used by teachers to enter the School Management website, then continue adding teachers, classes, modules, and students below.</p>
                </div>
                <div class="school-panel-stat">
                    <span class="school-panel-stat-label">Shared code</span>
                    <strong>${currentSetting?.accessCode ? "Active" : "Pending"}</strong>
                </div>
            </div>

            <form id="school-access-settings-form" class="school-form-grid school-form-grid-entity">
                <input id="school-access-school-name" class="field-input" type="text" placeholder="School name">
                <input id="school-access-code" class="field-input" type="text" placeholder="Set DOS / Teacher access code" required>
                <button class="primary-button" type="submit">Save access code</button>
            </form>

            <p id="school-access-helper-copy" class="school-record-note">Teachers use this DOS code together with their email, class, level, sector, trade, and module on the new School Management access page.</p>
        `;

        form = panel.querySelector("#school-access-settings-form");
        schoolNameInput = panel.querySelector("#school-access-school-name");
        accessCodeInput = panel.querySelector("#school-access-code");
        helperCopy = panel.querySelector("#school-access-helper-copy");

        form?.addEventListener("submit", handleSubmit);
        syncFields();
    }

    function syncFields() {
        if (schoolNameInput) {
            schoolNameInput.value = `${currentSetting?.schoolName || ""}`;
        }

        if (accessCodeInput) {
            accessCodeInput.value = `${currentSetting?.accessCode || ""}`;
        }

        if (helperCopy) {
            helperCopy.textContent = currentSetting?.accessCode
                ? "The current DOS code is active. Update it here when teachers need a new access password."
                : "Set a shared DOS code here first. Teachers will use it to open the School Management teacher portal.";
        }

        syncResolvedSchoolName();
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const schoolName = `${schoolNameInput?.value || ""}`.trim();
        const accessCode = `${accessCodeInput?.value || ""}`.trim();

        if (!accessCode) {
            onStatusChange?.("Enter the DOS access code before saving.", "error");
            return;
        }

        try {
            await withAppServiceLoading("Saving school access code...", async () => {
                const payload = {
                    schoolName,
                    accessCode
                };

                if (currentSetting?.id) {
                    await schoolStore.updateSchoolSetting(currentSetting.id, payload);
                } else {
                    await schoolStore.addSchoolSetting(payload);
                }

                const currentUserEmail = `${window.__JBNH_CURRENT_SCHOOL_EMAIL__ || ""}`.trim().toLowerCase();
                if (currentUserEmail) {
                    const existingUser = users.find((user) => `${user.email || ""}`.trim().toLowerCase() === currentUserEmail && `${user.role || ""}`.trim().toLowerCase() === "dos");
                    const dosPayload = {
                        role: "dos",
                        email: currentUserEmail,
                        name: `${window.__JBNH_CURRENT_SCHOOL_NAME__ || schoolName || "DOS"}`.trim(),
                        schoolName: schoolName || currentSetting?.schoolName || "",
                        accessCode,
                        linkedProfileId: `${window.__JBNH_CURRENT_SCHOOL_PROFILE_ID__ || ""}`.trim(),
                        uid: `${window.__JBNH_CURRENT_FIREBASE_UID__ || ""}`.trim()
                    };

                    if (existingUser?.id) {
                        await schoolStore.updateUser(existingUser.id, dosPayload);
                    } else {
                        await schoolStore.addUser(dosPayload);
                    }
                }
            });

            onStatusChange?.("School access code saved successfully.", "success");
        } catch (error) {
            console.error("School access code save failed:", error);
            onStatusChange?.("Could not save the school access code.", "error");
        }
    }

    return {
        init() {
            renderShell();

            const unsubscribe = schoolStore.subscribe("schoolSettings", (items) => {
                currentSetting = items[0] || null;
                if (panel) {
                    renderShell();
                }
            });
            const unsubscribeUsers = schoolStore.subscribe("users", (items) => {
                users = items;
            });

            return {
                destroy() {
                    unsubscribe();
                    unsubscribeUsers();
                }
            };
        }
    };
}
