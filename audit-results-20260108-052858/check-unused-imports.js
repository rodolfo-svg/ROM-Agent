const fs = require('fs');
const path = require('path');

function findUnusedImports(dir, results = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      findUnusedImports(fullPath, results);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Detectar imports
          const importMatch = line.match(/import\s+(?:{[^}]+}|[^from]+)\s+from\s+['"]([^'"]+)['"]/);
          if (importMatch) {
            const imported = line.match(/import\s+(?:{([^}]+)}|([^from]+))/)[1] || line.match(/import\s+(?:{([^}]+)}|([^from]+))/)[2];
            if (imported) {
              const items = imported.split(',').map(i => i.trim().replace(/as\s+\w+/, '').trim());
              items.forEach(item => {
                if (item && !item.includes('*')) {
                  const regex = new RegExp(`\\b${item}\\b`, 'g');
                  const matches = content.match(regex);
                  if (matches && matches.length <= 1) {
                    results.push({
                      file: fullPath,
                      line: index + 1,
                      import: item,
                      severity: 'P3'
                    });
                  }
                }
              });
            }
          }
        });
      } catch (err) {
        // Ignorar erros de leitura
      }
    }
  });

  return results;
}

const unusedImports = findUnusedImports('./src');
const frontendUnused = findUnusedImports('./frontend/src');
const allUnused = [...unusedImports, ...frontendUnused];

fs.writeFileSync('$AUDIT_DIR/unused-imports.json', JSON.stringify(allUnused, null, 2));
console.log('Total de imports não utilizados: ' + allUnused.length);
