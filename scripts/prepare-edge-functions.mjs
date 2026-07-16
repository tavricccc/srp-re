import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = path.join(projectRoot, 'supabase', 'functions');
const namespace = String(process.env.EDGE_FUNCTION_NAMESPACE ?? '').trim();
const functionNamespace = `n${namespace}`;
const mode = process.argv[2] ?? 'prepare';
const roles = {
  api: 'backendAction',
  sync: 'syncUser',
  media: 'cloudinaryWebhook',
  outbox: 'outboxWorker',
  delete: 'processDeletionJobs',
  maintenance: 'maintenanceCleanup',
};

if (!/^[a-z0-9]{16,48}$/u.test(namespace)) {
  throw new Error('EDGE_FUNCTION_NAMESPACE must contain 16-48 lowercase letters or digits.');
}

const generatedNames = Object.keys(roles).map((role) => `${functionNamespace}-${role}`);
if (mode === 'cleanup') {
  await Promise.all(generatedNames.map((name) => rm(path.join(functionsRoot, name), { recursive: true, force: true })));
  process.exit(0);
}
if (mode !== 'prepare') throw new Error('Expected prepare or cleanup.');

await mkdir(functionsRoot, { recursive: true });
for (const [role, sourceName] of Object.entries(roles)) {
  const source = path.join(functionsRoot, sourceName);
  const target = path.join(functionsRoot, `${functionNamespace}-${role}`);
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
}

const output = generatedNames.join(' ');
await readFile(path.join(functionsRoot, generatedNames[0], 'index.ts'), 'utf8');
process.stdout.write(output);
