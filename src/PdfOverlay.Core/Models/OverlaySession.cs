namespace PdfOverlay.Core.Models;

/// <summary>
/// Ephemeral session state. Never written to disk unless the user explicitly
/// exports a project file (not part of the PoC).
/// </summary>
public sealed class OverlaySession
{
    public LoadedDocument? DocumentA { get; set; }
    public LoadedDocument? DocumentB { get; set; }

    /// <summary>1-based page number.</summary>
    public int PageA { get; set; } = 1;

    /// <summary>1-based page number.</summary>
    public int PageB { get; set; } = 1;

    /// <summary>Opacity of document B when drawn over document A (0–1).</summary>
    public float Opacity { get; set; } = 0.5f;

    public void Reset()
    {
        DocumentA?.Dispose();
        DocumentB?.Dispose();
        DocumentA = null;
        DocumentB = null;
        PageA = 1;
        PageB = 1;
        Opacity = 0.5f;
    }
}
