namespace PdfOverlay.Core.Services;

/// <summary>
/// Portable-friendly temp workspace. Prefers a <c>temp</c> folder beside the
/// executable (USB-friendly). If that location is not writable, falls back to a
/// clearly named folder under the user profile temp area.
/// </summary>
public sealed class TempWorkspace : ITempWorkspace
{
    private readonly object _gate = new();
    private string _rootPath;
    private bool _disposed;

    public TempWorkspace(string? rootPath = null, bool isUsingFallbackLocation = false)
    {
        _rootPath = NormalizeRoot(rootPath ?? GetPreferredRoot());
        IsUsingFallbackLocation = isUsingFallbackLocation;
        EnsureRootExists();
        // Remove leftovers from a previous crash before the new session starts.
        ClearContents();
    }

    public string RootPath
    {
        get
        {
            ThrowIfDisposed();
            return _rootPath;
        }
    }

    public bool IsUsingFallbackLocation { get; private set; }

    /// <summary>
    /// Creates a workspace that prefers &lt;app&gt;\temp for USB/portable use, with a
    /// writable fallback when the app folder cannot be written (for example a
    /// read-only USB copy).
    /// </summary>
    public static TempWorkspace CreateForPortableApp()
    {
        var preferred = GetPreferredRoot();
        if (CanUseAsTempRoot(preferred))
        {
            return new TempWorkspace(preferred, isUsingFallbackLocation: false);
        }

        var fallback = GetFallbackRoot();
        return new TempWorkspace(fallback, isUsingFallbackLocation: true);
    }

    public static string GetPreferredRoot()
    {
        var baseDir = AppContext.BaseDirectory.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        return Path.Combine(baseDir, "temp");
    }

    /// <summary>Kept for callers/tests that expect the portable default path.</summary>
    public static string GetDefaultRoot() => GetPreferredRoot();

    public static string GetFallbackRoot()
    {
        // Still a clearly named app folder; used only when the portable location
        // is not writable. Cleared on exit / Clear Temporary Data.
        return Path.Combine(Path.GetTempPath(), "PdfOverlay", "temp");
    }

    public string GetTempFilePath(string extension)
    {
        ThrowIfDisposed();
        var ext = string.IsNullOrWhiteSpace(extension)
            ? ".tmp"
            : extension.StartsWith('.') ? extension : "." + extension;
        return Path.Combine(_rootPath, $"{Guid.NewGuid():N}{ext}");
    }

    public void Clear()
    {
        ThrowIfDisposed();
        lock (_gate)
        {
            ClearContents();
        }
    }

    public void Relocate(string newRootDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(newRootDirectory);
        ThrowIfDisposed();

        lock (_gate)
        {
            var next = NormalizeRoot(newRootDirectory);
            if (!CanUseAsTempRoot(next))
            {
                throw new IOException($"The folder is not writable: {next}");
            }

            if (string.Equals(_rootPath, next, StringComparison.OrdinalIgnoreCase))
            {
                EnsureRootExists();
                IsUsingFallbackLocation = false;
                return;
            }

            ClearContents();
            TryDeleteDirectory(_rootPath);
            _rootPath = next;
            IsUsingFallbackLocation = false;
            EnsureRootExists();
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        lock (_gate)
        {
            if (_disposed)
            {
                return;
            }

            try
            {
                ClearContents();
                TryDeleteDirectory(_rootPath);

                // If we used the fallback tree (.../PdfOverlay/temp), remove empty parents.
                TryRemoveEmptyParent(_rootPath);
                TryRemoveEmptyParent(Path.GetDirectoryName(_rootPath));
            }
            finally
            {
                _disposed = true;
            }
        }
    }

    private static bool CanUseAsTempRoot(string rootPath)
    {
        try
        {
            var full = NormalizeRoot(rootPath);
            Directory.CreateDirectory(full);
            var probe = Path.Combine(full, $".write-test-{Guid.NewGuid():N}");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            return false;
        }
    }

    private void EnsureRootExists()
    {
        Directory.CreateDirectory(_rootPath);
        // Marker helps users and IT reviewers identify the working folder.
        var readme = Path.Combine(_rootPath, "README.txt");
        if (!File.Exists(readme))
        {
            File.WriteAllText(
                readme,
                """
                PdfOverlay temporary working folder
                -----------------------------------
                This folder holds short-lived files created while PdfOverlay runs.
                Contents are deleted when you choose Clear Temporary Data or when
                the application closes. Original PDF files are never written here
                or modified.
                """);
        }
    }

    private void ClearContents()
    {
        if (!Directory.Exists(_rootPath))
        {
            Directory.CreateDirectory(_rootPath);
            return;
        }

        foreach (var file in Directory.EnumerateFiles(_rootPath))
        {
            TryDeleteFile(file);
        }

        foreach (var dir in Directory.EnumerateDirectories(_rootPath))
        {
            TryDeleteDirectory(dir);
        }

        EnsureRootExists();
    }

    private static string NormalizeRoot(string path) =>
        Path.GetFullPath(path.Trim());

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.SetAttributes(path, FileAttributes.Normal);
                File.Delete(path);
            }
        }
        catch (IOException)
        {
            // Best effort: remaining files are retried on next Clear/Dispose.
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, recursive: true);
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private static void TryRemoveEmptyParent(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            return;
        }

        try
        {
            if (!Directory.EnumerateFileSystemEntries(path).Any())
            {
                Directory.Delete(path, recursive: false);
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }
}
