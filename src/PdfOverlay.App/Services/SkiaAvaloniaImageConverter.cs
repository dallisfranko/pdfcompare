using System;
using System.IO;
using Avalonia.Media.Imaging;
using SkiaSharp;

namespace PdfOverlay.App.Services;

internal static class SkiaAvaloniaImageConverter
{
    /// <summary>
    /// Encodes an SKBitmap to an in-memory PNG for Avalonia display.
    /// Does not write to disk.
    /// </summary>
    public static Bitmap ToAvaloniaBitmap(SKBitmap skBitmap)
    {
        ArgumentNullException.ThrowIfNull(skBitmap);
        using var image = SKImage.FromBitmap(skBitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100)
            ?? throw new InvalidOperationException("Failed to encode page image.");
        using var managed = new MemoryStream();
        data.SaveTo(managed);
        managed.Position = 0;
        return new Bitmap(managed);
    }
}
