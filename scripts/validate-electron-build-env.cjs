const requiredVariables = [
    "JHB_GITHUB_OWNER",
    "JHB_GITHUB_REPO"
];

const missingVariables = requiredVariables.filter((name) => !`${process.env[name] || ""}`.trim());

if (missingVariables.length > 0) {
    console.error("Electron build configuration is missing required environment variables:");
    missingVariables.forEach((name) => {
        console.error(`- ${name}`);
    });
    console.error("");
    console.error("Set these variables before running `npm run build` so electron-builder can generate GitHub-based auto-update metadata.");
    process.exit(1);
}
