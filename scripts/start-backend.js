import { spawn } from "node:child_process";

const processes = [
  { name: "api", command: "node", args: ["app.js"] },
  { name: "payments", command: "node", args: ["workers/paymentValidator.js"] },
  { name: "withdrawals", command: "node", args: ["workers/withdrawalWorker.js"] },
];

const children = new Map();
let shuttingDown = false;

function prefixOutput(name, data, output) {
  const lines = String(data).split(/\r?\n/);
  for (const line of lines) {
    if (line) {
      output.write(`[${name}] ${line}\n`);
    }
  }
}

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children.values()) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const processConfig of processes) {
  const child = spawn(processConfig.command, processConfig.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  children.set(processConfig.name, child);

  child.stdout.on("data", (data) => prefixOutput(processConfig.name, data, process.stdout));
  child.stderr.on("data", (data) => prefixOutput(processConfig.name, data, process.stderr));

  child.on("exit", (code, signal) => {
    children.delete(processConfig.name);

    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[runner] ${processConfig.name} stopped with ${reason}`);
    stopAll();
    process.exitCode = code ?? 1;
  });
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
