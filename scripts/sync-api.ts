import { access, copyFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(
  repositoryRoot,
  process.env.EVEMERC_BACKEND_PATH ?? path.join('..', 'EveMerc'),
);
const source = path.join(backendRoot, 'storage', 'app', 'private', 'scribe', 'openapi.yaml');
const destinationDirectory = path.join(repositoryRoot, 'src', 'lib', 'api');
const destination = path.join(destinationDirectory, 'openapi.yaml');
const generatedTypes = path.join(destinationDirectory, 'schema.d.ts');

await access(source).catch(() => {
  throw new Error(`OpenAPI artifact not found at ${source}. Run php artisan scribe:generate first.`);
});
await mkdir(destinationDirectory, { recursive: true });
await copyFile(source, destination);

const openApiTypescript = path.join(repositoryRoot, 'node_modules', 'openapi-typescript', 'bin', 'cli.js');
execFileSync(process.execPath, [openApiTypescript, destination, '--output', generatedTypes], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});
