const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const possibleBrowsers = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

let browserPath = possibleBrowsers.find(p => fs.existsSync(p));
if (!browserPath) {
  console.error('Could not locate msedge or chrome executable!');
  process.exit(1);
}

console.log(`Using browser: ${browserPath}`);

const screenshots = [
  { name: '01-dashboard.png', url: 'http://localhost:54321/?tab=dashboard' },
  { name: '02-pos-billing.png', url: 'http://localhost:54321/?tab=billing' },
  { name: '03-records-history.png', url: 'http://localhost:54321/?tab=history' },
  { name: '04-invoice-preview.png', url: 'http://localhost:54321/?tab=history&view=first' },
  { name: '05-inventory.png', url: 'http://localhost:54321/?tab=inventory' },
  { name: '06-customers.png', url: 'http://localhost:54321/?tab=customers' },
  { name: '07-settings.png', url: 'http://localhost:54321/?settings=true' }
];

for (const s of screenshots) {
  const target = path.join(outDir, s.name);
  console.log(`Capturing ${s.name}...`);
  try {
    execSync(`"${browserPath}" --headless --disable-gpu --virtual-time-budget=2500 --window-size=1440,900 --screenshot="${target}" "${s.url}"`, {
      stdio: 'inherit'
    });
    console.log(`Saved: ${target}`);
  } catch (err) {
    console.error(`Failed to capture ${s.name}:`, err.message);
  }
}

console.log('✅ Finished capturing all screenshots!');
