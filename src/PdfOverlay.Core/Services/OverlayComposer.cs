using SkiaSharp;

namespace PdfOverlay.Core.Services;

public sealed class OverlayComposer : IOverlayComposer
{
    private static readonly SKSamplingOptions Sampling = new(SKFilterMode.Linear, SKMipmapMode.None);

    public SKBitmap Compose(SKBitmap bottom, SKBitmap top, float topOpacity) =>
        Compose(bottom, top, new OverlayComposeOptions(TopOpacity: topOpacity));

    public SKBitmap Compose(SKBitmap bottom, SKBitmap top, OverlayComposeOptions options)
    {
        ArgumentNullException.ThrowIfNull(bottom);
        ArgumentNullException.ThrowIfNull(top);
        ArgumentNullException.ThrowIfNull(options);

        var opacity = Math.Clamp(options.TopOpacity, 0f, 1f);
        var scale = Math.Clamp(options.TopScale, 0.1f, 4f);
        var topWidth = top.Width * scale;
        var topHeight = top.Height * scale;

        var minX = Math.Min(0f, options.OffsetX);
        var minY = Math.Min(0f, options.OffsetY);
        var maxX = Math.Max(bottom.Width, options.OffsetX + topWidth);
        var maxY = Math.Max(bottom.Height, options.OffsetY + topHeight);

        var width = Math.Max(1, (int)Math.Ceiling(maxX - minX));
        var height = Math.Max(1, (int)Math.Ceiling(maxY - minY));

        var info = new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
        var output = new SKBitmap(info);
        using var canvas = new SKCanvas(output);
        canvas.Clear(SKColors.White);

        var bottomX = -minX;
        var bottomY = -minY;
        canvas.DrawBitmap(bottom, bottomX, bottomY, Sampling);

        using var layerPaint = new SKPaint
        {
            Color = SKColors.White.WithAlpha((byte)Math.Round(opacity * 255f)),
        };
        canvas.SaveLayer(new SKRect(0, 0, width, height), layerPaint);
        var dest = new SKRect(
            bottomX + options.OffsetX,
            bottomY + options.OffsetY,
            bottomX + options.OffsetX + topWidth,
            bottomY + options.OffsetY + topHeight);
        canvas.DrawBitmap(top, new SKRect(0, 0, top.Width, top.Height), dest, Sampling);
        canvas.Restore();
        return output;
    }
}
