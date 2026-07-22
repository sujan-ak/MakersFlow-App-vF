import fs from 'fs';
import path from 'path';

const searchDir = 'c:/dev/MF/artifacts/mobile';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'scratch') {
        getFiles(filePath, fileList);
      }
    } else if ((file.endsWith('.tsx') || file.endsWith('.ts')) && file !== 'checkout.tsx' && file !== 'colors.ts') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getFiles(searchDir);
const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;

const counts = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const matches = content.match(hexRegex);
  if (matches && matches.length > 0) {
    const relPath = path.relative(searchDir, file).replace(/\\/g, '/');
    counts.push({ path: relPath, fullPath: file, count: matches.length });
  }
}

counts.sort((a, b) => b.count - a.count);

console.log("=== HARDCODED HEX COLOR OCCURRENCES BY FILE (EXCLUDING CHECKOUT & COLORS.TS) ===");
let total = 0;
counts.forEach(item => {
  console.log(`${item.count.toString().padStart(3, ' ')} occurrences | ${item.path}`);
  total += item.count;
});
console.log(`\nTotal hardcoded hex color instances found across ${counts.length} files: ${total}`);
