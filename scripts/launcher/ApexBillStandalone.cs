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
        private const string VERSION_RESOURCE = "BundleVersion.txt";

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(localAppData, "ApexBill", "bundle");
                string targetExe = Path.Combine(installDir, "ApexBill.exe");
                string versionFile = Path.Combine(installDir, ".bundle_version");

                Assembly currentAssembly = Assembly.GetExecutingAssembly();
                string currentVersion = GetEmbeddedVersion(currentAssembly);

                // Locate existing targetExe in installDir or subdirectories if present
                if (!File.Exists(targetExe) && Directory.Exists(installDir))
                {
                    string[] existing = Directory.GetFiles(installDir, "ApexBill.exe", SearchOption.AllDirectories);
                    if (existing.Length > 0)
                    {
                        targetExe = existing[0];
                    }
                }

                bool needsExtract = !File.Exists(targetExe) ||
                                    !File.Exists(versionFile) ||
                                    (!string.IsNullOrEmpty(currentVersion) && File.ReadAllText(versionFile).Trim() != currentVersion);

                if (needsExtract)
                {
                    if (Directory.Exists(installDir))
                    {
                        try
                        {
                            // Attempt to stop existing background node processes
                            ProcessStartInfo killPsi = new ProcessStartInfo("cmd.exe", "/c taskkill /F /IM node.exe")
                            {
                                CreateNoWindow = true,
                                WindowStyle = ProcessWindowStyle.Hidden,
                                UseShellExecute = false
                            };
                            Process p = Process.Start(killPsi);
                            if (p != null) p.WaitForExit(2000);
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
                            // Detect if all archive entries share a single common top-level directory
                            string commonRoot = null;
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                string norm = entry.FullName.Replace('\\', '/');
                                int slashIdx = norm.IndexOf('/');
                                if (slashIdx > 0)
                                {
                                    string root = norm.Substring(0, slashIdx + 1);
                                    if (commonRoot == null)
                                    {
                                        commonRoot = root;
                                    }
                                    else if (!norm.StartsWith(commonRoot, StringComparison.OrdinalIgnoreCase))
                                    {
                                        commonRoot = string.Empty;
                                        break;
                                    }
                                }
                                else
                                {
                                    commonRoot = string.Empty;
                                    break;
                                }
                            }

                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                string relativePath = entry.FullName.Replace('\\', '/');
                                if (!string.IsNullOrEmpty(commonRoot) && relativePath.StartsWith(commonRoot, StringComparison.OrdinalIgnoreCase))
                                {
                                    relativePath = relativePath.Substring(commonRoot.Length);
                                }

                                if (string.IsNullOrEmpty(relativePath) || relativePath == "/")
                                    continue;

                                string destPath = Path.Combine(installDir, relativePath.Replace('/', Path.DirectorySeparatorChar));

                                if (string.IsNullOrEmpty(entry.Name))
                                {
                                    Directory.CreateDirectory(destPath);
                                }
                                else
                                {
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

                    if (!string.IsNullOrEmpty(currentVersion))
                    {
                        File.WriteAllText(versionFile, currentVersion);
                    }

                    targetExe = Path.Combine(installDir, "ApexBill.exe");
                    if (!File.Exists(targetExe))
                    {
                        string[] matches = Directory.GetFiles(installDir, "ApexBill.exe", SearchOption.AllDirectories);
                        if (matches.Length > 0)
                        {
                            targetExe = matches[0];
                        }
                    }

                    CreateDesktopShortcut(targetExe);
                }

                // Verify targetExe and launch
                if (!File.Exists(targetExe))
                {
                    string[] fallback = Directory.Exists(installDir) ? Directory.GetFiles(installDir, "ApexBill.exe", SearchOption.AllDirectories) : new string[0];
                    if (fallback.Length > 0)
                    {
                        targetExe = fallback[0];
                    }
                }

                if (File.Exists(targetExe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = targetExe,
                        WorkingDirectory = Path.GetDirectoryName(targetExe),
                        UseShellExecute = true
                    };
                    if (args != null && args.Length > 0)
                    {
                        psi.Arguments = string.Join(" ", args);
                    }
                    Process.Start(psi);
                }
                else
                {
                    MessageBox.Show(
                        "Could not find ApexBill.exe after extraction in:\n" + installDir,
                        APP_NAME + " Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("ApexBill Standalone Launcher failed:\n\n" + ex.Message, APP_NAME + " Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static string GetEmbeddedVersion(Assembly assembly)
        {
            try
            {
                using (Stream stream = assembly.GetManifestResourceStream(VERSION_RESOURCE))
                {
                    if (stream != null)
                    {
                        using (StreamReader reader = new StreamReader(stream))
                        {
                            return reader.ReadToEnd().Trim();
                        }
                    }
                }
            }
            catch { }
            return assembly.GetName().Version.ToString();
        }

        private static void CreateDesktopShortcut(string targetExe)
        {
            try
            {
                if (!File.Exists(targetExe)) return;
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopDir, "ApexBill.lnk");

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
