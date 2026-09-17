namespace PdfOverlay.Core.Models;

/// <summary>
/// In-memory reference to a locally opened PDF. Paths are kept for display only
/// and are never persisted by the application.
/// </summary>
public sealed class LoadedDocument : IDisposable
{
    public LoadedDocument(string filePath, int pageCount)
    {
        FilePath = filePath;
        FileName = Path.GetFileName(filePath);
        PageCount = pageCount;
    }

    public string FilePath { get; }
    public string FileName { get; }
    public int PageCount { get; }

    public void Dispose()
    {
        // Path-only handle today; reserved for future native document handles.
    }
}
