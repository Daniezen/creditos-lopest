import { spawnSync } from "node:child_process";

const dummyDatabaseUrl =
  "postgresql://lopest_app_user:dummy_password@localhost:5432/lopest_core?schema=public";

function run(label, command, args, extraEnv = {}) {
  console.log(`\n[validate] ${label}`);
  console.log(`[validate] $ ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    console.error(`\n[validate] Falló: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("Prisma generate", "pnpm", ["exec", "prisma", "generate"], {
  DATABASE_URL: dummyDatabaseUrl,
});

run("ESLint", "pnpm", ["lint"]);

run("TypeScript", "pnpm", ["exec", "tsc", "--noEmit"]);

run("Next build", "pnpm", ["build"], {
  DATABASE_URL: dummyDatabaseUrl,
});

console.log("\n[validate] OK: lint, typecheck y build pasaron.");
