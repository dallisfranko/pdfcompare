using SkiaSharp;

namespace PdfOverlay.Core.Services;

public interface IOverlayComposer
{
    /// <summary>
    /// Draws <paramref name="top"/> over <paramref name="bottom"/> using
    /// <paramref name="topOpacity"/> (0–1). Caller owns the returned bitmap.
    /// </summary>
    SKBitmap Compose(SKBitmap bottom, SKBitmap top, float topOpacity);
}
