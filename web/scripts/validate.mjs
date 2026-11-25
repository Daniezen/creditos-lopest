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

// The VPS has ~8 GB shared with Postgres, n8n and the live app; Node's default
// heap ceiling made `next build` die mid-compile once the Casa y Negocio module
// landed. 3.5 GB is enough for the build and still leaves room for the rest.
// An explicit NODE_OPTIONS from the caller wins.
run("Next build", "pnpm", ["build"], {
  DATABASE_URL: dummyDatabaseUrl,
  NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=3584",
});

console.log("\n[validate] OK: lint, typecheck y build pasaron.");
