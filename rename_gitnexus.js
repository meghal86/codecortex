const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['.git', 'node_modules', 'dist', 'build', '.claude', '.claude-plugin', '.agents', '.sisyphus', 'codecortex', 'eval'];

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (IGNORE_DIRS.includes(file)) continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

let modifiedFiles = 0;

walk(__dirname, (filePath) => {
  if (!/\.(ts|tsx|md|json|html|cjs|mjs)$/.test(filePath)) return;
  if (filePath.endsWith('package-lock.json')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content
    .replace(/gitnexus/g, 'codecortex')
    .replace(/GitNexus/g, 'CodeCortex')
    .replace(/Gitnexus/g, 'Codecortex')
    .replace(/GITNEXUS/g, 'CODECORTEX');

  // Fix the specific error string reported by user again just to be sure
  newContent = newContent.replace('Run `gitnexus analyze`', 'Run `codecortex analyze`');
  
  // Update port 3030 to 4747 for backend URL
  newContent = newContent.replace(/http:\/\/localhost:3030/g, 'http://localhost:4747');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    modifiedFiles++;
    console.log(`Updated: ${filePath}`);
  }
});

console.log(`Total files modified: ${modifiedFiles}`);
