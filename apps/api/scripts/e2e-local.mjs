#!/usr/bin/env node
/**
 * Runs the e2e suite against local Postgres and Redis, the way CI does.
 *
 * This exists because the e2e suite needs real services, so it never ran on a developer
 * machine — and on 2026-10-05 a change that altered the /ready contract was pushed with the
 * unit suite green, broke an e2e assertion, and only failed in CI after the whole publish
 * pipeline had run. The infrastructure was already defined in infra/docker-compose.yml; what
 * was missing was one command that brings it up, points the suite at it, and tears nothing
 * down that was already yours.
 *
 * Usage:  npm run test:e2e:local --workspace=apps/api
 */
import { execFileSync, execSync } from 'node:child_process';
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

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', env, cwd: apiDir, ...opts });
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

console.log('→ starting postgres and redis');
run('docker', [
  'compose',
  '-f',
  compose,
  'up',
  '-d',
  '--wait',
  'postgres',
  'redis',
]);

console.log('→ applying migrations');
run('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma']);

console.log('→ seeding');
run('npm', ['run', 'prisma:seed'], { shell: process.platform === 'win32' });

console.log('→ running e2e');
try {
  run('npx', ['jest', '--config', './test/jest-e2e.json', '--runInBand', '--forceExit']);
  console.log('\ne2e passed.');
} catch {
  // The containers are deliberately left running: a failed run is exactly when you want to
  // inspect the database, and re-running is faster without a cold start. Stop them with
  //   docker compose -f infra/docker-compose.yml stop postgres redis
  console.error('\ne2e failed. Containers left running so you can inspect them.');
  process.exit(1);
}
