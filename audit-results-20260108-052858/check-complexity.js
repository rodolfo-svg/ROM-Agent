const fs = require('fs');
const path = require('path');

function analyzeComplexity(dir, results = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      analyzeComplexity(fullPath, results);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Detectar funções e calcular complexidade simplificada
        const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|\w+\s*:\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
        let match;

        while ((match = functionRegex.exec(content)) !== null) {
          const funcName = match[1] || match[2] || 'anonymous';
          const funcStart = match.index;

          // Encontrar o corpo da função (simplificado)
          let funcBody = content.substring(funcStart, funcStart + 5000);

          // Calcular complexidade (if, for, while, case, &&, ||, ?, catch)
          const complexity =
            (funcBody.match(/\bif\b/g) || []).length +
            (funcBody.match(/\bfor\b/g) || []).length +
            (funcBody.match(/\bwhile\b/g) || []).length +
            (funcBody.match(/\bcase\b/g) || []).length +
            (funcBody.match(/&&/g) || []).length +
            (funcBody.match(/\|\|/g) || []).length +
            (funcBody.match(/\?/g) || []).length +
            (funcBody.match(/\bcatch\b/g) || []).length + 1;

          if (complexity > 15) {
            results.push({
              file: fullPath,
              function: funcName,
              complexity: complexity,
              severity: complexity > 30 ? 'P1' : 'P2'
            });
          }
        }
      } catch (err) {
        // Ignorar
      }
    }
  });

  return results;
}

const complexFunctions = analyzeComplexity('./src');
fs.writeFileSync('$AUDIT_DIR/complexity.json', JSON.stringify(complexFunctions, null, 2));
console.log('Funções complexas encontradas: ' + complexFunctions.length);
