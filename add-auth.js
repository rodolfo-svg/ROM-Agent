const fs = require('fs');
const content = fs.readFileSync('src/server-enhanced.js', 'utf8');

// Routes que devem ficar PUBLICAS
const publicRoutes = [
  '/api/auth/',
  '/api/debug/',
  '/health',
  '/api/csrf-token'
];

// Adicionar requireAuth em routes sem auth
let modified = content;
const lines = content.split('\n');
let changes = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Se é uma route definition
  if (line.match(/app\.(get|post|put|delete)\s*\(['"]\//)) {
    // Já tem auth?
    if (line.includes('authMiddleware') || line.includes('requireAuth')) {
      continue;
    }
    
    // É rota pública?
    let isPublic = publicRoutes.some(pub => line.includes(pub));
    if (isPublic) continue;
    
    // Adicionar requireAuth
    const match = line.match(/(app\.(get|post|put|delete)\s*\(['"]\/)([^'"]+)(['"])\s*,\s*([^,]+),\s*(.+)/);
    if (match) {
      const [_, prefix, method, route, quote, middleware, rest] = match;
      // Se já tem middleware (generalLimiter, uploadLimiter, etc), adicionar requireAuth depois
      lines[i] = line.replace(
        `${prefix}${route}${quote}, ${middleware},`,
        `${prefix}${route}${quote}, authSystem.authMiddleware(), ${middleware},`
      );
      changes++;
    } else {
      // Sem middleware, adicionar direto
      const match2 = line.match(/(app\.(get|post|put|delete)\s*\(['"]\/)([^'"]+)(['"])\s*,\s*(async\s*)?\(/);
      if (match2) {
        lines[i] = line.replace(/,\s*(async\s*)?\(/, ', authSystem.authMiddleware(), $1(');
        changes++;
      }
    }
  }
}

console.log(`✅ Adicionado requireAuth em ${changes} routes`);
fs.writeFileSync('src/server-enhanced.js', lines.join('\n'));
