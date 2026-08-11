namespace PdfOverlay.Core.Services;

/// <summary>
/// Portable-friendly temp workspace. Default location is a <c>temp</c> folder
/// beside the executable so the app does not need a Windows install or registry.
/// </summary>
public sealed class TempWorkspace : ITempWorkspace
{
    private readonly object _gate = new();
    private string _rootPath;
    private bool _disposed;

    public TempWorkspace(string? rootPath = null)
    {
        _rootPath = NormalizeRoot(rootPath ?? GetDefaultRoot());
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

    public static string GetDefaultRoot()
    {
        var baseDir = AppContext.BaseDirectory.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        return Path.Combine(baseDir, "temp");
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
            if (string.Equals(_rootPath, next, StringComparison.OrdinalIgnoreCase))
            {
                EnsureRootExists();
                return;
            }

            ClearContents();
            TryDeleteDirectory(_rootPath);
            _rootPath = next;
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
            }
            finally
            {
                _disposed = true;
            }
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

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }
}
