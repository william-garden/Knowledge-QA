const { spawn } = require("child_process");
const path = require("path");

const frontendDir = path.resolve(__dirname, "..", "..", "frontend");
const command = process.platform === "win32" ? "npm run dev -- --host" : "npm run dev -- --host";

const child = spawn(command, {
  cwd: frontendDir,
  stdio: "inherit",
  shell: true
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
