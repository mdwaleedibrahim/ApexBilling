const { execSync } = require('child_process');

try {
  const output = execSync('netstat -ano | findstr :54321', { encoding: 'utf8' });
  const lines = output.split('\n');
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5 && parts[1].includes(':54321')) {
      const pid = parseInt(parts[4]);
      if (pid && pid > 4) {
        pids.add(pid);
      }
    }
  }

  if (pids.size > 0) {
    console.log(`[ApexBill] Stopping server on port 54321 (PIDs: ${Array.from(pids).join(', ')})...`);
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`[ApexBill] Stopped PID ${pid}.`);
      } catch (err) {
        // ignore
      }
    }
  } else {
    console.log('[ApexBill] No server process running on port 54321.');
  }
} catch (err) {
  // netstat returns exit code 1 if no matches found
  console.log('[ApexBill] No server process running on port 54321.');
}
