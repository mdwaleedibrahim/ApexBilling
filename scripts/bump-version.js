const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

const rootPkgPath = path.join(rootDir, 'package.json');

function bumpMinorVersion(versionStr) {
  const parts = versionStr.split('.');
  if (parts.length >= 2) {
    const major = parseInt(parts[0], 10) || 1;
    const minor = parseInt(parts[1], 10) + 1;
    const patch = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;
    return `${major}.${minor}.${patch}`;
  }
  return versionStr;
}

if (!fs.existsSync(rootPkgPath)) {
  console.error(`[Error] root package.json not found at ${rootPkgPath}`);
  process.exit(1);
}

const rootPkgContent = fs.readFileSync(rootPkgPath, 'utf8');
const rootPkgJson = JSON.parse(rootPkgContent);
const oldVer = rootPkgJson.version || '1.0.0';
const newVersion = bumpMinorVersion(oldVer);
rootPkgJson.version = newVersion;
fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkgJson, null, 2) + '\n', 'utf8');
console.log(`[Version Bump] package.json: ${oldVer} -> ${newVersion}`);

// Update CHANGELOG.txt with git commit history
const changelogPath = path.join(rootDir, 'CHANGELOG.txt');
const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

let gitCommits = '';
try {
  const rawCommits = execSync('git log -n 6 --pretty=format:"%s (%h)"', { cwd: rootDir, encoding: 'utf8' }).trim();
  gitCommits = rawCommits
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `  * ${line}`)
    .join('\n');
} catch (e) {
  gitCommits = '  * Automated release build and package update.';
}

const newEntry = `========================================================================
ApexBill Release v${newVersion} - ${timestamp}
========================================================================
Changes & Commits in this Build:
${gitCommits || '  * Incremented minor version & compiled release package.'}

`;

const header = `========================================================================
                    ApexBill Product Changelog
========================================================================\n\n`;

let previousEntries = '';
if (fs.existsSync(changelogPath)) {
  const fullContent = fs.readFileSync(changelogPath, 'utf8');
  if (fullContent.startsWith(header)) {
    previousEntries = fullContent.slice(header.length);
  } else {
    const marker = '========================================================================\nApexBill Release';
    const index = fullContent.indexOf(marker);
    if (index !== -1) {
      previousEntries = fullContent.slice(index);
    } else {
      const crlfMarker = '========================================================================\r\nApexBill Release';
      const crlfIndex = fullContent.indexOf(crlfMarker);
      if (crlfIndex !== -1) {
        previousEntries = fullContent.slice(crlfIndex);
      } else {
        previousEntries = fullContent;
      }
    }
  }
}

fs.writeFileSync(changelogPath, header + newEntry + previousEntries, 'utf8');
console.log(`[Changelog] Updated ${path.relative(rootDir, changelogPath)} for v${newVersion}`);

console.log(`\nSuccessfully bumped minor version to v${newVersion}\n`);
