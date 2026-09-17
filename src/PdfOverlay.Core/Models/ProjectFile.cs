namespace PdfOverlay.Core.Models;

/// <summary>
/// Explicitly exported project settings. Does not embed PDF bytes.
/// Paths are optional hints; the app never auto-saves this file.
/// </summary>
public sealed class ProjectFile
{
    public int Version { get; set; } = 1;
    public string? DocumentAPath { get; set; }
    public string? DocumentBPath { get; set; }
    public int PageA { get; set; } = 1;
    public int PageB { get; set; } = 1;
    public float Opacity { get; set; } = 0.5f;
    public float OffsetX { get; set; }
    public float OffsetY { get; set; }
    public float TopScale { get; set; } = 1f;
}
