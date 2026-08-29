using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;

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
        Console.WriteLine("  ║   Chatterbox TTS + WhisperX  ║");
        Console.WriteLine("  ╚══════════════════════════════╝");
        Console.ResetColor();
        Console.WriteLine();

        // ── Locate batch or ps1 launcher ───────────────────────────────────
        string exeDir    = AppDomain.CurrentDomain.BaseDirectory;
        string batPath   = Path.Combine(exeDir, "start.bat");
        string ps1Path   = Path.Combine(exeDir, "start.ps1");

        bool forceBat = false;
        List<string> forwardArgs = new List<string>();

        foreach (string rawArg in args)
        {
            string a = rawArg.Trim();
            if (a.Equals("-bat", StringComparison.OrdinalIgnoreCase) || a.Equals("--bat", StringComparison.OrdinalIgnoreCase))
            {
                forceBat = true;
            }
            else
            {
                forwardArgs.Add(a);
            }
        }

        ProcessStartInfo psi = null;

        if (!forceBat && File.Exists(ps1Path))
        {
            string psExe = FindPowerShell() ?? "powershell.exe";
            string extraArgs = forwardArgs.Count > 0 ? " " + string.Join(" ", forwardArgs) : "";
            string psArgs = string.Format("-ExecutionPolicy Bypass -File \"{0}\"{1}", ps1Path, extraArgs);
            
            WriteInfo("Launching AutoTranscribe via PowerShell engine...");
            Console.WriteLine();

            psi = new ProcessStartInfo
            {
                FileName               = psExe,
                Arguments              = psArgs,
                WorkingDirectory       = exeDir,
                UseShellExecute        = false,
                RedirectStandardOutput = false,
                RedirectStandardError  = false,
                CreateNoWindow         = false,
            };
        }
        else if (File.Exists(batPath))
        {
            WriteInfo("Launching AutoTranscribe via Command Prompt batch engine...");
            Console.WriteLine();

            psi = new ProcessStartInfo
            {
                FileName               = "cmd.exe",
                Arguments              = string.Format("/c \"{0}\"", batPath),
                WorkingDirectory       = exeDir,
                UseShellExecute        = false,
                RedirectStandardOutput = false,
                RedirectStandardError  = false,
                CreateNoWindow         = false,
            };
        }
        else
        {
            WriteError("Neither start.ps1 nor start.bat found in application folder: " + exeDir);
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
            WriteError("Error executing launcher: " + ex.Message);
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
