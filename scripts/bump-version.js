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

// Find existing commit hashes from previous entries in CHANGELOG.txt to avoid duplicating past commits
const recordedHashes = new Set();
const hashRegex = /\(([a-f0-9]{7,40})\)/g;
let match;
while ((match = hashRegex.exec(previousEntries)) !== null) {
  recordedHashes.add(match[1].toLowerCase());
}

let gitCommits = '';
try {
  const rawLog = execSync('git log -n 100 --pretty=format:"%h%x09%s"', { cwd: rootDir, encoding: 'utf8' }).trim();
  const lines = rawLog.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const newCommitLines = [];

  for (const line of lines) {
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) continue;
    const hash = line.slice(0, tabIdx).trim().toLowerCase();
    const subject = line.slice(tabIdx + 1).trim();

    // Stop as soon as we hit a commit that was already documented in previous release changelog
    if (recordedHashes.has(hash)) {
      break;
    }
    newCommitLines.push(`  * ${subject} (${hash})`);
  }

  if (newCommitLines.length > 0) {
    gitCommits = newCommitLines.join('\n');
  } else if (recordedHashes.size === 0 && lines.length > 0) {
    // If no previous changelog history exists at all, take the latest 5 commits
    gitCommits = lines.slice(0, 5).map(line => {
      const tabIdx = line.indexOf('\t');
      const hash = line.slice(0, tabIdx).trim();
      const subject = line.slice(tabIdx + 1).trim();
      return `  * ${subject} (${hash})`;
    }).join('\n');
  }
} catch (e) {
  gitCommits = '  * Automated release build and package update.';
}

const newEntry = `========================================================================
ApexBill Release v${newVersion} - ${timestamp}
========================================================================
Changes & Commits in this Build:
${gitCommits || '  * Incremented minor version & compiled release package.'}

`;

fs.writeFileSync(changelogPath, header + newEntry + previousEntries, 'utf8');
console.log(`[Changelog] Updated ${path.relative(rootDir, changelogPath)} for v${newVersion}`);

console.log(`\nSuccessfully bumped minor version to v${newVersion}\n`);
