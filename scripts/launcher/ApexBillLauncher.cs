using System;
using System.Diagnostics;
using System.Drawing;
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

        private static readonly string NodeConfigPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            @"ApexBill\node_path.txt"
        );

        private static readonly string LocalRuntimeDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            @"ApexBill\runtime"
        );

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                // Ensure TLS 1.2 is enabled for modern HTTPS downloads
                try
                {
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls;
                }
                catch { }

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

                // 2. Locate or install node.exe runtime
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string nodeExe = ResolveNodeExe(baseDir);
                if (string.IsNullOrEmpty(nodeExe) || !File.Exists(nodeExe))
                {
                    // ResolveNodeExe displays user-friendly dialogs if missing or offline
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
                    catch { }
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
            // 1. Check remembered installation path
            if (File.Exists(NodeConfigPath))
            {
                try
                {
                    string saved = File.ReadAllText(NodeConfigPath).Trim();
                    if (!string.IsNullOrEmpty(saved) && File.Exists(saved))
                    {
                        return saved;
                    }
                }
                catch { }
            }

            // 2. Check local AppData runtime folder
            string localRuntime = Path.Combine(LocalRuntimeDir, "node.exe");
            if (File.Exists(localRuntime))
            {
                SaveRememberedNodePath(localRuntime);
                return localRuntime;
            }

            // 3. Check portable runtime folder in current or parent directory
            string portableNode = Path.Combine(baseDir, @"runtime\node.exe");
            if (File.Exists(portableNode))
            {
                SaveRememberedNodePath(portableNode);
                return portableNode;
            }

            string parentNode = Path.Combine(baseDir, @"..\runtime\node.exe");
            if (File.Exists(parentNode))
            {
                string fullParent = Path.GetFullPath(parentNode);
                SaveRememberedNodePath(fullParent);
                return fullParent;
            }

            // 4. Check standard Program Files & local programs installations
            string pfNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"nodejs\node.exe");
            if (File.Exists(pfNode))
            {
                SaveRememberedNodePath(pfNode);
                return pfNode;
            }

            string pfX86Node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"nodejs\node.exe");
            if (File.Exists(pfX86Node))
            {
                SaveRememberedNodePath(pfX86Node);
                return pfX86Node;
            }

            string userProgramsNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\nodejs\node.exe");
            if (File.Exists(userProgramsNode))
            {
                SaveRememberedNodePath(userProgramsNode);
                return userProgramsNode;
            }

            // 5. Search in system PATH
            string pathNode = FindInPath("node.exe");
            if (!string.IsNullOrEmpty(pathNode) && File.Exists(pathNode))
            {
                SaveRememberedNodePath(pathNode);
                return pathNode;
            }

            // 6. Node.js is not installed: download & install in background with popup and 30-second timeout
            return DownloadAndInstallNode();
        }

        private static void SaveRememberedNodePath(string path)
        {
            try
            {
                string dir = Path.GetDirectoryName(NodeConfigPath);
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
                File.WriteAllText(NodeConfigPath, path);
            }
            catch { }
        }

        private static string DownloadAndInstallNode()
        {
            string downloadUrl = Environment.Is64BitOperatingSystem
                ? "https://nodejs.org/dist/v22.14.0/win-x64/node.exe"
                : "https://nodejs.org/dist/v22.14.0/win-x86/node.exe";

            string targetExe = Path.Combine(LocalRuntimeDir, "node.exe");
            string tempExe = targetExe + ".download";

            // 1. Verify internet connectivity and download initiation within 30 seconds
            bool internetAvailable = false;
            try
            {
                HttpWebRequest pingReq = (HttpWebRequest)WebRequest.Create(downloadUrl);
                pingReq.Method = "HEAD";
                pingReq.Timeout = 30000; // 30 seconds
                pingReq.ReadWriteTimeout = 30000;
                using (HttpWebResponse pingRes = (HttpWebResponse)pingReq.GetResponse())
                {
                    if (pingRes.StatusCode == HttpStatusCode.OK)
                    {
                        internetAvailable = true;
                    }
                }
            }
            catch
            {
                internetAvailable = false;
            }

            if (!internetAvailable)
            {
                MessageBox.Show(
                    "Internet not available. Connect to internet to download the required nodejs.",
                    APP_TITLE + " - Internet Required",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return null;
            }

            // 2. Show background download popup and download node.exe
            try
            {
                if (!Directory.Exists(LocalRuntimeDir))
                {
                    Directory.CreateDirectory(LocalRuntimeDir);
                }
                if (File.Exists(tempExe)) File.Delete(tempExe);
            }
            catch { }

            bool downloadSuccess = false;
            string downloadError = null;
            NodeInstallProgressForm progressForm = new NodeInstallProgressForm();

            Thread dlThread = new Thread(() =>
            {
                try
                {
                    using (WebClient wc = new WebClient())
                    {
                        wc.DownloadProgressChanged += (sender, e) =>
                        {
                            string info = string.Format("{0:F1} MB / {1:F1} MB ({2}%)",
                                e.BytesReceived / 1048576.0,
                                e.TotalBytesToReceive / 1048576.0,
                                e.ProgressPercentage);
                            progressForm.UpdateProgress(e.ProgressPercentage, info);
                        };

                        wc.DownloadFileCompleted += (sender, e) =>
                        {
                            if (e.Error != null)
                            {
                                downloadError = e.Error.Message;
                            }
                            else if (!e.Cancelled)
                            {
                                downloadSuccess = true;
                            }
                            try { progressForm.BeginInvoke(new Action(() => progressForm.Close())); } catch { }
                        };

                        wc.DownloadFileAsync(new Uri(downloadUrl), tempExe);
                    }
                }
                catch (Exception ex)
                {
                    downloadError = ex.Message;
                    try { progressForm.BeginInvoke(new Action(() => progressForm.Close())); } catch { }
                }
            });

            dlThread.IsBackground = true;
            dlThread.Start();

            progressForm.ShowDialog();

            if (downloadSuccess && File.Exists(tempExe))
            {
                try
                {
                    if (File.Exists(targetExe)) File.Delete(targetExe);
                    File.Move(tempExe, targetExe);
                    SaveRememberedNodePath(targetExe);
                    return targetExe;
                }
                catch (Exception ex)
                {
                    MessageBox.Show(
                        "Failed to finalize Node.js installation:\n" + ex.Message,
                        APP_TITLE + " Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return null;
                }
            }
            else
            {
                try { if (File.Exists(tempExe)) File.Delete(tempExe); } catch { }
                if (!string.IsNullOrEmpty(downloadError))
                {
                    MessageBox.Show(
                        "Failed to download Node.js runtime:\n" + downloadError + "\n\nPlease check your internet connection and try again.",
                        APP_TITLE + " - Download Failed",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                return null;
            }
        }

        private static void ResolveServerScript(string baseDir, out string scriptPath, out string workingDir)
        {
            string p1 = Path.Combine(baseDir, @"app\dist\index.js");
            if (File.Exists(p1))
            {
                scriptPath = p1;
                workingDir = Path.Combine(baseDir, "app");
                return;
            }

            string p2 = Path.Combine(baseDir, @"src\server\dist\index.js");
            if (File.Exists(p2))
            {
                scriptPath = p2;
                workingDir = Path.Combine(baseDir, @"src\server");
                return;
            }

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

    public class NodeInstallProgressForm : Form
    {
        private ProgressBar progressBar;
        private Label lblDetails;

        public NodeInstallProgressForm()
        {
            this.Text = "ApexBill";
            this.Size = new Size(430, 160);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.ControlBox = false;
            this.TopMost = true;
            this.ShowInTaskbar = true;

            Label lblTitle = new Label();
            lblTitle.Text = "Node.js is being installed in the background...";
            lblTitle.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            lblTitle.Location = new Point(22, 18);
            lblTitle.Size = new Size(380, 22);
            this.Controls.Add(lblTitle);

            Label lblSub = new Label();
            lblSub.Text = "This is a one-time setup. Please wait while files are downloaded.";
            lblSub.Font = new Font("Segoe UI", 9);
            lblSub.Location = new Point(22, 42);
            lblSub.Size = new Size(380, 20);
            this.Controls.Add(lblSub);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(22, 70);
            progressBar.Size = new Size(370, 20);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            lblDetails = new Label();
            lblDetails.Text = "Connecting...";
            lblDetails.Font = new Font("Segoe UI", 8);
            lblDetails.ForeColor = Color.DarkGray;
            lblDetails.Location = new Point(22, 96);
            lblDetails.Size = new Size(370, 18);
            this.Controls.Add(lblDetails);
        }

        public void UpdateProgress(int percent, string details)
        {
            if (this.IsDisposed) return;
            if (this.InvokeRequired)
            {
                try { this.BeginInvoke(new Action(() => UpdateProgress(percent, details))); } catch { }
                return;
            }
            if (percent >= 0 && percent <= 100)
            {
                progressBar.Value = percent;
            }
            if (!string.IsNullOrEmpty(details))
            {
                lblDetails.Text = details;
            }
        }
    }
}
