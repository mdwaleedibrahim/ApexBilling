using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace ApexBill.Launcher
{
    static class Program
    {
        private const int PORT = 54321;
        private const string APP_URL = "http://localhost:54321";
        private const string HEALTH_URL = "http://127.0.0.1:54321/api/health";
        private const string APP_TITLE = "ApexBill";

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                // Process CLI flags
                if (args.Length > 0)
                {
                    string flag = args[0].ToLowerInvariant().Trim('-', '/');
                    if (flag == "stop" || flag == "kill")
                    {
                        StopExistingServer();
                        MessageBox.Show("ApexBill background server has been stopped.", APP_TITLE, MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return;
                    }
                    if (flag == "restart")
                    {
                        StopExistingServer();
                        Thread.Sleep(800);
                    }
                    if (flag == "status")
                    {
                        bool running = IsServerRunning();
                        MessageBox.Show(running ? "ApexBill server is RUNNING on port " + PORT : "ApexBill server is NOT running.", APP_TITLE, MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return;
                    }
                    if (flag == "help" || flag == "?")
                    {
                        MessageBox.Show("ApexBill Desktop Launcher\n\nUsage:\n  ApexBill.exe          Launch application\n  ApexBill.exe --restart Restart server\n  ApexBill.exe --stop   Stop background server\n  ApexBill.exe --status Check server status\n", APP_TITLE, MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return;
                    }
                }

                // 1. Check if server is already active
                if (IsServerRunning())
                {
                    OpenApplicationWindow();
                    return;
                }

                // 2. Locate node.exe runtime
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string nodeExe = ResolveNodeExe(baseDir);
                if (string.IsNullOrEmpty(nodeExe) || !File.Exists(nodeExe))
                {
                    MessageBox.Show(
                        "Node.js runtime was not found.\n\nPlease ensure runtime\\node.exe exists or Node.js is installed on this PC.",
                        APP_TITLE + " - Missing Runtime",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                // 3. Locate server index.js entrypoint
                string scriptPath;
                string workingDir;
                ResolveServerScript(baseDir, out scriptPath, out workingDir);
                if (string.IsNullOrEmpty(scriptPath) || !File.Exists(scriptPath))
                {
                    MessageBox.Show(
                        "ApexBill application bundle was not found.\n\nExpected entrypoint: app\\dist\\index.js",
                        APP_TITLE + " - Missing Assets",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                // 4. Start Node.js backend silently in background
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodeExe;
                psi.Arguments = "--experimental-sqlite \"" + scriptPath + "\"";
                psi.WorkingDirectory = workingDir;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                Process serverProc = Process.Start(psi);

                // 5. Wait for server readiness
                bool ready = WaitForServerReady(10000);
                if (!ready)
                {
                    // If still not ready, give a brief safety wait
                    Thread.Sleep(1000);
                }

                // 6. Launch in standalone desktop application window
                OpenApplicationWindow();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Failed to launch ApexBill:\n\n" + ex.Message,
                    APP_TITLE + " Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static bool IsServerRunning()
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", PORT, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(400);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool WaitForServerReady(int timeoutMs)
        {
            int elapsed = 0;
            const int interval = 150;
            while (elapsed < timeoutMs)
            {
                if (IsServerRunning())
                {
                    try
                    {
                        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(HEALTH_URL);
                        request.Timeout = 500;
                        request.Method = "GET";
                        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                        {
                            if (response.StatusCode == HttpStatusCode.OK)
                            {
                                return true;
                            }
                        }
                    }
                    catch
                    {
                        // Port might be open before HTTP handler is attached
                    }
                }
                Thread.Sleep(interval);
                elapsed += interval;
            }
            return false;
        }

        private static void OpenApplicationWindow()
        {
            // Try Microsoft Edge App Mode (Chromium based, built into Windows 10/11)
            string edgePath = FindEdgeExecutable();
            if (!string.IsNullOrEmpty(edgePath) && File.Exists(edgePath))
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = edgePath;
                    psi.Arguments = "--app=" + APP_URL + " --name=" + APP_TITLE;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                    return;
                }
                catch { }
            }

            // Fallback to Google Chrome App Mode if available
            string chromePath = FindChromeExecutable();
            if (!string.IsNullOrEmpty(chromePath) && File.Exists(chromePath))
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = chromePath;
                    psi.Arguments = "--app=" + APP_URL;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                    return;
                }
                catch { }
            }

            // Fallback to system default web browser
            try
            {
                Process.Start(APP_URL);
            }
            catch
            {
                Process.Start(new ProcessStartInfo("cmd", "/c start " + APP_URL) { CreateNoWindow = true });
            }
        }

        private static string FindEdgeExecutable()
        {
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (string p in possiblePaths)
            {
                if (File.Exists(p)) return p;
            }

            // Check PATH
            return FindInPath("msedge.exe");
        }

        private static string FindChromeExecutable()
        {
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string p in possiblePaths)
            {
                if (File.Exists(p)) return p;
            }

            return FindInPath("chrome.exe");
        }

        private static string FindInPath(string exeName)
        {
            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            string[] dirs = pathEnv.Split(';');
            foreach (string dir in dirs)
            {
                try
                {
                    string candidate = Path.Combine(dir.Trim(), exeName);
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }
            return null;
        }

        private static string ResolveNodeExe(string baseDir)
        {
            // 1. Check portable runtime folder
            string portableNode = Path.Combine(baseDir, @"runtime\node.exe");
            if (File.Exists(portableNode)) return portableNode;

            // 2. Check parent directory portable runtime
            string parentNode = Path.Combine(baseDir, @"..\runtime\node.exe");
            if (File.Exists(parentNode)) return Path.GetFullPath(parentNode);

            // 3. Check Standard Node.js Program Files
            string programFilesNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"nodejs\node.exe");
            if (File.Exists(programFilesNode)) return programFilesNode;

            // 4. Search in PATH
            return FindInPath("node.exe");
        }

        private static void ResolveServerScript(string baseDir, out string scriptPath, out string workingDir)
        {
            // 1. Portable package layout: baseDir\app\dist\index.js
            string p1 = Path.Combine(baseDir, @"app\dist\index.js");
            if (File.Exists(p1))
            {
                scriptPath = p1;
                workingDir = Path.Combine(baseDir, "app");
                return;
            }

            // 2. Local root / src layout: baseDir\src\server\dist\index.js
            string p2 = Path.Combine(baseDir, @"src\server\dist\index.js");
            if (File.Exists(p2))
            {
                scriptPath = p2;
                workingDir = Path.Combine(baseDir, @"src\server");
                return;
            }

            // 3. Server dist layout: baseDir\dist\index.js
            string p3 = Path.Combine(baseDir, @"dist\index.js");
            if (File.Exists(p3))
            {
                scriptPath = p3;
                workingDir = baseDir;
                return;
            }

            scriptPath = null;
            workingDir = baseDir;
        }

        private static void StopExistingServer()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :54321') do taskkill /F /PID %a";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process p = Process.Start(psi);
                p.WaitForExit(3000);
            }
            catch { }
        }
    }
}
