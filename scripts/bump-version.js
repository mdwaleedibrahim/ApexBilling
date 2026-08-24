const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

const packagePaths = [
  path.join(rootDir, 'package.json'),
  path.join(rootDir, 'client', 'package.json'),
  path.join(rootDir, 'server', 'package.json'),
];

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

let newVersion = '';

packagePaths.forEach((pkgPath) => {
  if (fs.existsSync(pkgPath)) {
    const content = fs.readFileSync(pkgPath, 'utf8');
    const json = JSON.parse(content);
    if (!newVersion) {
      newVersion = bumpMinorVersion(json.version || '1.0.0');
    }
    const oldVer = json.version;
    json.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    console.log(`[Version Bump] ${path.relative(rootDir, pkgPath)}: ${oldVer} -> ${newVersion}`);
  }
});

// Update CHANGELOG.txt with git commit history
const changelogPath = path.join(rootDir, 'CHANGELOG.txt');
const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

let gitCommits = '';
try {
  gitCommits = execSync('git log -n 6 --pretty=format:"  * %s (%h)"', { cwd: rootDir, encoding: 'utf8' }).trim();
} catch (e) {
  gitCommits = '  * Automated release build and package update.';
}

const newEntry = `========================================================================
ApexBill Release v${newVersion} - ${timestamp}
========================================================================
Changes & Commits in this Build:
${gitCommits || '  * Incremented minor version & compiled release package.'}

`;

let existingChangelog = '';
if (fs.existsSync(changelogPath)) {
  existingChangelog = fs.readFileSync(changelogPath, 'utf8');
} else {
  existingChangelog = `========================================================================
                    ApexBill Product Changelog
========================================================================\n\n`;
}

fs.writeFileSync(changelogPath, existingChangelog + newEntry, 'utf8');
console.log(`[Changelog] Updated ${path.relative(rootDir, changelogPath)} for v${newVersion}`);

console.log(`\nSuccessfully bumped minor version to v${newVersion}\n`);
