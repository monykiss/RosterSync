import { spawnSync } from 'node:child_process';

function run(label: string, command: string, args: string[]) {
  console.log(label);

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Resetting demo data...');

run('Syncing schema...', 'npx', ['prisma', 'db', 'push', '--skip-generate']);
run('Seeding demo data...', 'npx', ['tsx', 'prisma/seed.ts']);

console.log('Demo data reset complete.');
