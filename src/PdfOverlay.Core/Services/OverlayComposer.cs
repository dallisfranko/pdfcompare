using SkiaSharp;

namespace PdfOverlay.Core.Services;

public sealed class OverlayComposer : IOverlayComposer
{
    private static readonly SKSamplingOptions Sampling = new(SKFilterMode.Linear, SKMipmapMode.None);

    public SKBitmap Compose(SKBitmap bottom, SKBitmap top, float topOpacity)
    {
        ArgumentNullException.ThrowIfNull(bottom);
        ArgumentNullException.ThrowIfNull(top);

        var opacity = Math.Clamp(topOpacity, 0f, 1f);
        var width = Math.Max(bottom.Width, top.Width);
        var height = Math.Max(bottom.Height, top.Height);

        var info = new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
        var output = new SKBitmap(info);
        using var canvas = new SKCanvas(output);
        canvas.Clear(SKColors.White);
        canvas.DrawBitmap(bottom, 0, 0, Sampling);

        using var layerPaint = new SKPaint
        {
            Color = SKColors.White.WithAlpha((byte)Math.Round(opacity * 255f)),
        };
        canvas.SaveLayer(new SKRect(0, 0, width, height), layerPaint);
        canvas.DrawBitmap(top, 0, 0, Sampling);
        canvas.Restore();
        return output;
    }
}
