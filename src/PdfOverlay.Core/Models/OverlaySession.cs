namespace PdfOverlay.Core.Models;

/// <summary>
/// Ephemeral session state. Alignment/opacity are kept in memory only unless the
/// user explicitly exports a project file.
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

    /// <summary>Horizontal offset applied to document B, in pixels at render DPI.</summary>
    public float OffsetX { get; set; }

    /// <summary>Vertical offset applied to document B, in pixels at render DPI.</summary>
    public float OffsetY { get; set; }

    /// <summary>Scale applied to document B relative to document A (1 = same size).</summary>
    public float TopScale { get; set; } = 1f;

    public void ResetAlignment()
    {
        OffsetX = 0f;
        OffsetY = 0f;
        TopScale = 1f;
        Opacity = 0.5f;
    }

    public void Reset()
    {
        DocumentA?.Dispose();
        DocumentB?.Dispose();
        DocumentA = null;
        DocumentB = null;
        PageA = 1;
        PageB = 1;
        ResetAlignment();
    }
}
