// The InstaSafe mark — the supplied artwork, parsed, not redrawn.
// ---------------------------------------------------------------------------
// The geometry below is the path data from
// console/public/brand/instasafe-mark-color.svg, verbatim: nine orange paths
// (eight broken concentric rings and the wedge) plus the purple sphere. It is
// parsed into a GraphicsPath once (SvgPath.cs) and then scaled into whatever
// box it is asked for, so the mark is the mark at 16px and at 160px.
//
// The file's own transform — translate(-81.01, -85.14) on every path, and none
// on the ellipse — is applied here rather than baked into the strings, so the
// strings can be re-copied from the brand file without editing.
//
// viewBox: 917.98 x 909.71.
// ---------------------------------------------------------------------------

using System.Drawing;
using System.Drawing.Drawing2D;

namespace InstaSafeAgent
{
    static class Brand
    {
        public static readonly Color Orange = Color.FromArgb(0xF0, 0x68, 0x23);
        public static readonly Color Purple = Color.FromArgb(0x65, 0x2C, 0x8F);

        const float VBW = 917.98f, VBH = 909.71f;
        const float TX = -81.01f, TY = -85.14f;

        static readonly string[] RINGS = {
            "M209.88,316.12s24.4-36.76,54.9-66.53l45.31,45.52s-41.76,43.52-49.21,54.59Z",
            "M538.26,994.86C286.13,994.86,81,790.81,81,540S286.13,85.14,538.26,85.14c128.29,0,246.22,48.56,332.07,136.73C953.3,307.08,999,420.06,999,540,999,795.06,796.61,994.86,538.26,994.86Zm0-900.41c-247,0-447.95,199.87-447.95,445.55s201,445.55,448,445.55c253.14,0,451.43-195.71,451.43-445.55S791.4,94.45,538.26,94.45Z",
            "M532.69,969.9c-110.68,0-214.43-42.64-293.12-120.7C154.8,765.12,107.18,647.68,108.92,527l12.41.18c-1.69,117.33,44.59,231.5,127,313.22,76.33,75.72,177,117.1,284.38,117.1,3.15,0,6.28,0,9.43-.1l.28,12.4C539.16,969.86,535.91,969.9,532.69,969.9Z",
            "M395.66,710.43C347.05,665.2,318,602.87,318,543.7,318,421.46,417.05,322,538.77,322S759.53,421.46,759.53,543.7c0,51.75-23.6,110.53-61.6,153.4l-20.88-18.51c33.65-38,54.56-89.67,54.56-134.89,0-106.84-86.5-193.77-192.84-193.77S345.94,436.86,345.94,543.7c0,50.79,26.33,106.84,68.73,146.3Z",
            "M253.4,406.9l-82.58-35.07,1.43-3.53c.23-.56,22.93-55.7,76.86-111.36,49.78-51.38,137.17-113.86,270.76-119.76l3.85-.17,3.86,77.08-3.68.37c-1.84.18-185.48,20.13-268.88,189.16ZM181,367.72l68.74,29.19c44.72-88.29,116-135.21,168.23-159.08,48.75-22.27,89.35-29,101.53-30.65l-3.11-62.07C387.49,151.91,303,212.46,254.68,262.34,209.52,308.94,186.79,354.92,181,367.72Z",
            "M538.32,812.08c-149.26,0-270.69-121.57-270.69-271,0-74.92,40-146.51,77.35-188.52l24.32,21.65c-33.41,37.54-69.1,101.08-69.1,166.87,0,131.47,106.82,238.44,238.12,238.44C665.51,779.52,773,670.33,773,541.08c0-68.25-30.88-134.29-84.71-181.17l21.39-24.56c60.93,53.08,95.88,128.06,95.88,205.73C805.52,688,683.16,812.08,538.32,812.08Z",
            "M538.77,892.57c-138.12,0-263.63-81.3-319.74-207.11l38.24-17.05C306.66,779.15,417.15,850.7,538.77,850.7c169.75,0,307.86-137.55,307.86-306.62S708.52,237.46,538.77,237.46A306.27,306.27,0,0,0,407,266.88L389.16,229a347.86,347.86,0,0,1,149.61-33.43c192.84,0,349.73,156.33,349.73,348.49S731.61,892.57,538.77,892.57Z",
            "M532.19,923V910.6c208.22,0,373.14-166,375.46-377.9l12.4.13c-1.17,106.76-41.95,205.58-114.84,278.28C732.86,883.27,635.9,923,532.19,923Z",
            "M950.25,543.65c-7.21-228.34-189.56-410-415.13-413.47l.34-21.7c114.6,1.78,222.75,47.8,304.54,129.57A449.7,449.7,0,0,1,972,543Z"
        };

        static GraphicsPath ringsPath, corePath;

        /// Built once. The parse is cheap, but a tray icon is rebuilt on every
        /// state change and a toast repaints on every frame of its slide.
        static void Build()
        {
            if (ringsPath != null) return;

            var rings = new GraphicsPath(FillMode.Winding);
            foreach (var d in RINGS)
                using (var p = SvgPath.Parse(d))
                {
                    using (var m = new Matrix()) { m.Translate(TX, TY); p.Transform(m); }
                    rings.AddPath(p, false);
                }
            ringsPath = rings;

            var core = new GraphicsPath();
            core.AddEllipse(457.77f - 154.52f, 461.66f - 155.22f, 154.52f * 2f, 155.22f * 2f);
            corePath = core;
        }

        /// <summary>The mark, scaled to fill <paramref name="box"/>.</summary>
        public static void Mark(Graphics g, RectangleF box, Color ring, Color core, float alpha = 1f)
        {
            Build();

            float side = System.Math.Min(box.Width, box.Height);
            float s = side / System.Math.Max(VBW, VBH);
            int a = (int)(255 * alpha);

            var old = g.Save();
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TranslateTransform(box.X + (box.Width - VBW * s) / 2f,
                                 box.Y + (box.Height - VBH * s) / 2f);
            g.ScaleTransform(s, s);

            // The whole mark, at every size. Seven of the nine orange elements
            // are hairlines and they blur together in a tray icon — which is
            // fine, it still reads as the InstaSafe mark. Dropping elements to
            // make it crisper would make the agent the one place where the logo
            // is not the logo.
            using (var b = new SolidBrush(Color.FromArgb(a, ring)))
                g.FillPath(b, ringsPath);

            using (var b = new SolidBrush(Color.FromArgb(a, core)))
                g.FillPath(b, corePath);

            g.Restore(old);
        }

        /// <summary>An alias kept so callers can say what they mean.</summary>
        public static void MarkSmall(Graphics g, RectangleF box, Color ring, Color core, float alpha = 1f)
        {
            Mark(g, box, ring, core, alpha);
        }

        /// <summary>The mark with the wordmark beside it, for a header.</summary>
        public static void Lockup(Graphics g, PointF at, float markSize, Color ring, Color core, Color ink)
        {
            Mark(g, new RectangleF(at.X, at.Y, markSize, markSize), ring, core);
            using (var f = new Font("Segoe UI", markSize * 0.46f, FontStyle.Bold))
            using (var b = new SolidBrush(ink))
                g.DrawString("InstaSafe", f, b, at.X + markSize * 1.12f, at.Y + markSize * 0.22f);
        }

        /// <summary>
        /// A tray icon: the mark plus a state badge.
        ///
        /// A badge rather than recolouring the mark, because a red version of
        /// your own logo is what people then carry around in their heads. Only
        /// Disconnected desaturates, and that reads as "off", not as a brand.
        /// </summary>
        public static Icon Tray(State s, int px)
        {
            var bmp = new Bitmap(px, px);
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.Transparent);
                g.SmoothingMode = SmoothingMode.AntiAlias;

                bool live = s == State.Connected;
                var ring = s == State.Disconnected ? Color.FromArgb(0x8A, 0x8E, 0x9B) : Orange;
                var core = s == State.Disconnected ? Color.FromArgb(0x6E, 0x72, 0x80) : Purple;
                float alpha = live ? 1f : (s == State.Disconnected ? 0.85f : 0.75f);

                // A white plate under the mark. The notification area sits on
                // the taskbar, which is near-black by default and can be any
                // wallpaper colour when it is translucent; an orange ring on
                // that is a smudge. On a disc the mark always has its own
                // background, which is what every well-behaved tray icon does.
                float side = px * 0.86f;
                using (var plate = new SolidBrush(Color.FromArgb((int)(255 * alpha), Color.White)))
                    g.FillEllipse(plate, 0, 0, side, side);
                using (var edge = new Pen(Color.FromArgb((int)(70 * alpha), 0, 0, 0), System.Math.Max(0.8f, px * 0.025f)))
                    g.DrawEllipse(edge, 0.5f, 0.5f, side - 1, side - 1);

                float pad = side * 0.14f;
                Mark(g, new RectangleF(pad, pad, side - pad * 2, side - pad * 2), ring, core, alpha);

                if (s == State.Disconnected) return Icon.FromHandle(bmp.GetHicon());

                float bd = px * 0.46f;
                var br = new RectangleF(px - bd, px - bd, bd, bd);
                Color badge = s == State.Connected ? Color.FromArgb(0x2E, 0xA6, 0x6E)
                            : s == State.Connecting ? Color.FromArgb(0xE0, 0xA0, 0x46)
                            : Color.FromArgb(0xD8, 0x58, 0x44);
                using (var k = new SolidBrush(Color.White))
                    g.FillEllipse(k, br.X - px * 0.035f, br.Y - px * 0.035f, bd + px * 0.07f, bd + px * 0.07f);
                using (var b = new SolidBrush(badge)) g.FillEllipse(b, br);

                using (var p = new Pen(Color.White, System.Math.Max(1.1f, px * 0.055f))
                               { StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    float m = br.X + bd / 2f, n = br.Y + bd / 2f, q = bd * 0.22f;
                    if (s == State.Connected)
                        g.DrawLines(p, new[] { new PointF(m - q, n), new PointF(m - q * 0.15f, n + q * 0.8f), new PointF(m + q, n - q * 0.7f) });
                    else if (s == State.Dropped)
                    {
                        g.DrawLine(p, m - q, n - q, m + q, n + q);
                        g.DrawLine(p, m + q, n - q, m - q, n + q);
                    }
                    else
                        using (var d = new SolidBrush(Color.White)) g.FillEllipse(d, m - q * 0.5f, n - q * 0.5f, q, q);
                }
            }
            return Icon.FromHandle(bmp.GetHicon());
        }
    }
}
