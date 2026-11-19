# Uso puntual: quita el verde croma de la moneda 2v2 (mismo croma de tools/build-hd.mjs), recorta al contenido y reduce a NxN con alfa.
#   powershell -File moneda-croma.ps1 <entrada.png> <salida.png> [N=256]
param([string]$In, [string]$Out, [int]$N = 256)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Croma {
  public static int[] Run(string inp, string outp, int N) {
    using (var src = new Bitmap(inp)) {
      int W = src.Width, H = src.Height;
      var bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb);
      using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, W, H);
      var rect = new Rectangle(0, 0, W, H);
      var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int bytes = Math.Abs(data.Stride) * H; var px = new byte[bytes];
      Marshal.Copy(data.Scan0, px, 0, bytes);
      int x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
        int i = y * data.Stride + x * 4; // BGRA
        int b = px[i], gg = px[i + 1], r = px[i + 2];
        int m = Math.Max(r, b); int d = gg - m; int a = 255;
        if (d > 60) { px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0; continue; }
        if (d > 12) { px[i + 1] = (byte)Math.Min(gg, m); a = (int)Math.Round(255.0 * (1 - (d - 12) / 48.0)); px[i + 3] = (byte)a; }
        else if (d > 0) px[i + 1] = (byte)m;
        if (a > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      Marshal.Copy(px, 0, data.Scan0, bytes); bmp.UnlockBits(data);
      // recorte cuadrado centrado en el contenido, con 2 % de margen
      int cw = x1 - x0 + 1, ch = y1 - y0 + 1; int side = (int)Math.Round(Math.Max(cw, ch) * 1.02);
      int cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      var srcRect = new Rectangle(cx - side / 2, cy - side / 2, side, side);
      using (var o = new Bitmap(N, N, PixelFormat.Format32bppArgb))
      using (var g2 = Graphics.FromImage(o)) {
        g2.Clear(Color.Transparent);
        g2.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g2.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
        g2.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        g2.DrawImage(bmp, new Rectangle(0, 0, N, N), srcRect, GraphicsUnit.Pixel);
        o.Save(outp, ImageFormat.Png);
      }
      bmp.Dispose();
      return new int[] { W, H, x0, y0, x1, y1, side };
    }
  }
}
"@ -ReferencedAssemblies System.Drawing
$r = [Croma]::Run((Resolve-Path $In).Path, (Join-Path (Get-Location) $Out), $N)
"W=$($r[0]) H=$($r[1]) box=$($r[2]),$($r[3]),$($r[4]),$($r[5]) lado=$($r[6]) -> $Out ${N}x${N}"
