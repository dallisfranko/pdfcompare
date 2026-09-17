using SkiaSharp;

namespace PdfOverlay.Core.Services;

public sealed record OverlayComposeOptions(
    float TopOpacity = 0.5f,
    float OffsetX = 0f,
    float OffsetY = 0f,
    float TopScale = 1f);

public interface IOverlayComposer
{
    /// <summary>
    /// Draws <paramref name="top"/> over <paramref name="bottom"/> using the given options.
    /// Caller owns the returned bitmap.
    /// </summary>
    SKBitmap Compose(SKBitmap bottom, SKBitmap top, OverlayComposeOptions options);

    /// <summary>Convenience overload for opacity-only composition.</summary>
    SKBitmap Compose(SKBitmap bottom, SKBitmap top, float topOpacity);
}
