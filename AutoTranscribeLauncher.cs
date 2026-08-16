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

        // ── Locate start.ps1 ────────────────────────────────────────────────
        string exeDir    = AppDomain.CurrentDomain.BaseDirectory;
        string scriptPath = Path.Combine(exeDir, "start.ps1");

        if (!File.Exists(scriptPath))
        {
            WriteError("start.ps1 not found next to this executable.");
            WriteError("Make sure AutoTranscribe.exe is in the repo root folder.");
            Console.WriteLine();
            Pause();
            return;
        }

        // ── Check PowerShell ─────────────────────────────────────────────────
        string psExe = FindPowerShell();
        if (psExe == null)
        {
            WriteError("PowerShell not found. Please install PowerShell 5.1+.");
            Console.WriteLine();
            Pause();
            return;
        }

        WriteInfo("Launching AutoTranscribe...");
        Console.WriteLine();

        // ── Run start.ps1 ────────────────────────────────────────────────────
        var psi = new ProcessStartInfo
        {
            FileName               = psExe,
            Arguments              = string.Format("-ExecutionPolicy Bypass -File \"{0}\"", scriptPath),
            UseShellExecute        = false,
            RedirectStandardOutput = false,
            RedirectStandardError  = false,
            CreateNoWindow         = false,
        };

        try
        {
            using (var proc = Process.Start(psi))
            {
                if (proc == null)
                {
                    WriteError("Failed to start PowerShell process.");
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
