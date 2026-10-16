import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modulesDir = path.resolve(__dirname, '../../modules');

function getAllSourceFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllSourceFiles(fullPath));
    } else if (fullPath.endsWith('.ts') && !fullPath.includes('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Modular Monolith Architecture Enforcement', () => {
  const sourceFiles = getAllSourceFiles(modulesDir);
  const moduleNames = fs.readdirSync(modulesDir).filter(name => {
    return fs.statSync(path.join(modulesDir, name)).isDirectory();
  });

  it('Strict Module Isolation: No module may import another module\'s internal files', () => {
    const forbiddenImports: { file: string; imported: string }[] = [];

    for (const file of sourceFiles) {
      const relPath = path.relative(modulesDir, file);
      const currentModule = relPath.split(path.sep)[0];
      const content = fs.readFileSync(file, 'utf8');

      for (const targetModule of moduleNames) {
        if (targetModule === currentModule) continue;

        // Check if file imports from targetModule internals (anything not ending in targetModule/index.js)
        const regex = new RegExp(`from\\s+['\"][^'\"]*modules\\/${targetModule}\\/(?!index\\.js['\"])[^'\"]+['\"]`, 'g');
        const matches = content.match(regex);
        if (matches) {
          matches.forEach(m => {
            forbiddenImports.push({ file: relPath, imported: m });
          });
        }
      }
    }

    expect(forbiddenImports, `Found forbidden cross-module private imports: ${JSON.stringify(forbiddenImports, null, 2)}`).toHaveLength(0);
  });

  it('Clean Architecture: Domain layer must NEVER depend on Express, pg, or HTTP presentation', () => {
    const domainViolations: { file: string; imported: string }[] = [];

    const domainFiles = sourceFiles.filter(f => f.includes(`${path.sep}domain${path.sep}`));

    for (const file of domainFiles) {
      const relPath = path.relative(modulesDir, file);
      const content = fs.readFileSync(file, 'utf8');

      // Check for forbidden frameworks in domain
      const forbiddenPackages = ['express', 'pg', 'supertest', 'cors', 'helmet'];
      for (const pkg of forbiddenPackages) {
        const regex = new RegExp(`from\\s+['\"]${pkg}['\"]`, 'g');
        if (regex.test(content)) {
          domainViolations.push({ file: relPath, imported: pkg });
        }
      }

      // Check for importing presentation layer
      if (content.includes('/presentation/')) {
        domainViolations.push({ file: relPath, imported: 'presentation layer' });
      }
    }

    expect(domainViolations, `Domain layer contains forbidden external dependencies: ${JSON.stringify(domainViolations, null, 2)}`).toHaveLength(0);
  });

  it('All business modules must expose a public index.ts entry point', () => {
    for (const mod of moduleNames) {
      const indexPath = path.join(modulesDir, mod, 'index.ts');
      expect(fs.existsSync(indexPath), `Module '${mod}' is missing public index.ts entry point`).toBe(true);
    }
  });
});
