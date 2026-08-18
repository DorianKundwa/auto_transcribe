using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

class AutoTranscribeLauncher
{
    static void Main(string[] args)
    {
        Console.Title = "AutoTranscribe Launcher";
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        // ── Header ──────────────────────────────────────────────────────────
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine();
        Console.WriteLine("  ╔══════════════════════════════╗");
        Console.WriteLine("  ║     AutoTranscribe  v1.0     ║");
        Console.WriteLine("  ╚══════════════════════════════╝");
        Console.ResetColor();
        Console.WriteLine();

        // ── Locate batch or ps1 launcher ───────────────────────────────────
        string exeDir    = AppDomain.CurrentDomain.BaseDirectory;
        string batPath   = Path.Combine(exeDir, "start.bat");
        string ps1Path   = Path.Combine(exeDir, "start.ps1");

        WriteInfo("Launching AutoTranscribe...");
        Console.WriteLine();

        ProcessStartInfo psi;

        if (File.Exists(ps1Path))
        {
            string psExe = FindPowerShell() ?? "powershell.exe";
            psi = new ProcessStartInfo
            {
                FileName               = psExe,
                Arguments              = string.Format("-ExecutionPolicy Bypass -File \"{0}\" -Prod", ps1Path),
                WorkingDirectory       = exeDir,
                UseShellExecute        = false,
                RedirectStandardOutput = false,
                RedirectStandardError  = false,
                CreateNoWindow         = false,
            };
        }
        else
        {
            WriteError("start.ps1 not found in application folder.");
            Console.WriteLine();
            Pause();
            return;
        }

        try
        {
            using (var proc = Process.Start(psi))
            {
                if (proc == null)
                {
                    WriteError("Failed to start launcher process.");
                    Pause();
                    return;
                }
                proc.WaitForExit();
            }
        }
        catch (Exception ex)
        {
            WriteError("Error: " + ex.Message);
            Console.WriteLine();
            Pause();
        }
    }

    static string FindPowerShell()
    {
        // Prefer pwsh (PowerShell 7+), fall back to powershell.exe (5.1)
        foreach (var name in new[] { "pwsh.exe", "powershell.exe" })
        {
            foreach (var dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
            {
                try
                {
                    string full = Path.Combine(dir.Trim(), name);
                    if (File.Exists(full)) return full;
                }
                catch { }
            }
        }
        // Absolute fallback for powershell.exe
        string sys32 = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.System),
            "WindowsPowerShell\\v1.0\\powershell.exe");
        return File.Exists(sys32) ? sys32 : null;
    }

    static void WriteInfo(string msg)
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.Write("  ► ");
        Console.ResetColor();
        Console.WriteLine(msg);
    }

    static void WriteError(string msg)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("  ✖ " + msg);
        Console.ResetColor();
    }

    static void Pause()
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  Press any key to exit...");
        Console.ResetColor();
        Console.ReadKey(true);
    }
}
