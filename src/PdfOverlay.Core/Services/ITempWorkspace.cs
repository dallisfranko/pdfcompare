namespace PdfOverlay.Core.Services;

/// <summary>
/// Owns the single application temporary working folder.
/// All scratch files created by the app must live under <see cref="RootPath"/>.
/// </summary>
public interface ITempWorkspace : IDisposable
{
    string RootPath { get; }

    /// <summary>
    /// True when the preferred portable temp folder (beside the exe) was not writable
    /// and a fallback location was used instead.
    /// </summary>
    bool IsUsingFallbackLocation { get; }

    /// <summary>Creates a uniquely named file path under the temp root (file is not created).</summary>
    string GetTempFilePath(string extension);

    /// <summary>Deletes all contents under the temp root and recreates the empty folder.</summary>
    void Clear();

    /// <summary>
    /// Moves the temp root to a user-chosen directory. Clears the previous root first.
    /// </summary>
    void Relocate(string newRootDirectory);
}
