#!/usr/bin/env node
/**
 * Runs the e2e suite against local Postgres and Redis, the way CI does.
 *
 * This exists because the e2e suite needs real services, so it never ran on a developer
 * machine — and on 2026-10-05 a change that altered the /ready contract was pushed with the
 * unit suite green, broke an e2e assertion, and only failed in CI after the whole publish
 * pipeline had run. The infrastructure was already defined in infra/docker-compose.yml; what
 * was missing was one command that brings it up and points the suite at it.
 *
 * Usage:  npm run test:e2e:local --workspace=apps/api
 */
import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, '..');
const repoRoot = path.resolve(apiDir, '..', '..');
const compose = path.join(repoRoot, 'infra', 'docker-compose.yml');

// Matches the CI job exactly. The migrate user owns DDL; the app user is what the application
// connects as and is created by the migration itself.
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://socverse_app:socverse_app_dev_password@localhost:5432/socverse',
  MIGRATE_DATABASE_URL:
    'postgresql://socverse:socverse_dev_password@localhost:5432/socverse',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'local-e2e-secret-not-for-production',
  NODE_ENV: 'test',
};

/**
 * Tools are invoked as `node <cli.js>` rather than through npm or npx.
 *
 * On Windows those are .cmd shims: execFileSync cannot resolve them by bare name, and Node 22
 * refuses to spawn them at all without a shell. Using a shell instead would mean quoting every
 * argument correctly, and this repository's path contains a space — so the quoting would be
 * the next thing to break. Calling the JavaScript entrypoint directly sidesteps all of it and
 * behaves identically on every platform.
 */
const require = createRequire(path.join(apiDir, 'package.json'));
const PRISMA = require.resolve('prisma/build/index.js');
// jest's package exports do not expose bin/, so locate it from the package root.
const JEST = path.join(
  path.dirname(require.resolve('jest/package.json')),
  'bin',
  'jest.js',
);

function run(cli, args) {
  execFileSync(process.execPath, [cli, ...args], {
    stdio: 'inherit',
    env,
    cwd: apiDir,
  });
}

function dockerIsUp() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!dockerIsUp()) {
  console.error(
    '\nDocker is not running.\n' +
      'Start Docker Desktop (or your daemon) and try again — this suite needs a real\n' +
      'Postgres and Redis, which is exactly why it is worth running before pushing.\n',
  );
  process.exit(1);
}

// The dev stack's api and worker are declared `restart: unless-stopped`, so Docker brings them
// back whenever it starts — and the worker then competes with the one this suite boots
// in-process for the same BullMQ queues. It wins some jobs, fails them against whatever Prisma
// client its image was built with, and the suite times out waiting for telemetry that was
// generated into a different schema. The symptom looks nothing like the cause, so stop them.
console.log('→ stopping dev api/worker/web (the suite runs its own in-process)');
try {
  execFileSync(
    'docker',
    ['compose', '-f', compose, 'stop', 'api', 'worker', 'web'],
    { stdio: 'ignore', env, cwd: apiDir },
  );
} catch {
  // Not running is the normal case and perfectly fine.
}

console.log('→ starting postgres and redis');
execFileSync(
  'docker',
  ['compose', '-f', compose, 'up', '-d', '--wait', 'postgres', 'redis'],
  { stdio: 'inherit', env, cwd: apiDir },
);

console.log('→ applying migrations');
run(PRISMA, ['migrate', 'deploy', '--schema', 'prisma/schema.prisma']);

console.log('→ seeding');
run(PRISMA, ['db', 'seed']);

console.log('→ running e2e');
try {
  run(JEST, ['--config', './test/jest-e2e.json', '--runInBand', '--forceExit']);
  console.log('\ne2e passed.');
} catch {
  // Containers are deliberately left running: a failed run is exactly when you want to inspect
  // the database, and re-running is faster without a cold start. Stop them with
  //   docker compose -f infra/docker-compose.yml stop postgres redis
  console.error('\ne2e failed. Containers left running so you can inspect them.');
  process.exit(1);
}
