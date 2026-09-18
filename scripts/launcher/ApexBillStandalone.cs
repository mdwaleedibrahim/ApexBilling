using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

namespace ApexBill.Standalone
{
    static class Program
    {
        private const string APP_NAME = "ApexBill";
        private const string RESOURCE_NAME = "ApexBillBundle.zip";

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(localAppData, "ApexBill", "bundle");
                string targetExe = Path.Combine(installDir, "ApexBill.exe");
                string versionFile = Path.Combine(installDir, ".bundle_version");

                // Get current assembly build timestamp or version
                Assembly currentAssembly = Assembly.GetExecutingAssembly();
                string currentBuildId = currentAssembly.GetName().Version.ToString();

                bool needsExtract = !File.Exists(targetExe) || !File.Exists(versionFile) || File.ReadAllText(versionFile).Trim() != currentBuildId;

                if (needsExtract)
                {
                    if (Directory.Exists(installDir))
                    {
                        try
                        {
                            // Attempt to stop existing processes in installDir
                            ProcessStartInfo killPsi = new ProcessStartInfo("cmd.exe", "/c taskkill /F /IM node.exe")
                            {
                                CreateNoWindow = true,
                                WindowStyle = ProcessWindowStyle.Hidden,
                                UseShellExecute = false
                            };
                            Process.Start(killPsi).WaitForExit(2000);
                        }
                        catch { }
                    }

                    Directory.CreateDirectory(installDir);

                    // Extract embedded ZIP resource
                    using (Stream zipStream = currentAssembly.GetManifestResourceStream(RESOURCE_NAME))
                    {
                        if (zipStream == null)
                        {
                            MessageBox.Show("Embedded application payload was not found.", APP_NAME + " Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            return;
                        }

                        using (ZipArchive archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
                        {
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                if (string.IsNullOrEmpty(entry.Name))
                                {
                                    // Directory entry
                                    string dirPath = Path.Combine(installDir, entry.FullName);
                                    Directory.CreateDirectory(dirPath);
                                }
                                else
                                {
                                    string destPath = Path.Combine(installDir, entry.FullName);
                                    string parent = Path.GetDirectoryName(destPath);
                                    if (!Directory.Exists(parent))
                                    {
                                        Directory.CreateDirectory(parent);
                                    }
                                    entry.ExtractToFile(destPath, true);
                                }
                            }
                        }
                    }

                    File.WriteAllText(versionFile, currentBuildId);
                    CreateDesktopShortcut(targetExe);
                }

                // Launch ApexBill.exe inside bundle
                if (File.Exists(targetExe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = targetExe,
                        WorkingDirectory = installDir,
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                }
                else
                {
                    MessageBox.Show("Could not find " + targetExe + " after extraction.", APP_NAME + " Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("ApexBill Standalone Launcher failed:\n\n" + ex.Message, APP_NAME + " Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void CreateDesktopShortcut(string targetExe)
        {
            try
            {
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopDir, "ApexBill.lnk");
                if (File.Exists(shortcutPath)) return;

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetExe;
                    shortcut.WorkingDirectory = Path.GetDirectoryName(targetExe);
                    shortcut.Description = "ApexBill Modern Billing & POS System";
                    shortcut.IconLocation = targetExe + ",0";
                    shortcut.Save();
                }
            }
            catch { }
        }
    }
}
