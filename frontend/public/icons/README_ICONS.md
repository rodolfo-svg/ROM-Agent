# App Icons Generation

## Required Sizes:
- 192x192 (Android)
- 512x512 (Android splash)
- 180x180 (iOS apple-touch-icon)

## How to Generate:
1. Use online tool: https://realfavicongenerator.net/
2. Upload icon-base.svg
3. Download all sizes
4. Place in public/icons/

## Or use sharp (Node.js):
```bash
npm install -D sharp
node scripts/generate-icons.js
```
