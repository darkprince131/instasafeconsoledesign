// InstaSafe i365 Agent — design prototype
// ---------------------------------------------------------------------------
// A real Windows executable, so the things that only exist on a desktop can
// actually be judged: a tray icon at 16 pixels, a panel that opens above the
// clock, a toast that slides in over whatever you were doing.
//
// Written against the .NET Framework that ships with Windows and compiled with
// the csc.exe already on the machine — no SDK, no package manager, no runtime
// to install. That matters for a prototype somebody has to be able to run
// without being handed a toolchain first.
//
// What it is not: it does not connect to anything. Every state is driven from
// the tray menu so a reviewer can sit in each one for as long as they like,
// including the three the shipped agent never draws — connecting, dropped and
// failed.
//
// The design decisions it exists to demonstrate, each one answering something
// found in the shipped agent:
//
//   * The tray panel says the state in words. Today you must hover the icon,
//     and the menu infers it from which item is greyed out.
//   * Four icon states differ in silhouette, not only colour, so they survive
//     16 pixels and colour blindness.
//   * Toasts carry the product name and actions. Today Windows titles them
//     "InstaSafe-Agent.exe" because the binary has no version resource.
//   * Errors say what happened, why, and what to do next, in reserved space
//     that does not shove the buttons down when it appears.
//   * One red. Today the critical-error colour is on the About box.
//   * Process-level DPI awareness, so nothing is bitmap-stretched.
// ---------------------------------------------------------------------------

using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace InstaSafeAgent
{
    // ---------------------------------------------------------------- theme
    static class T
    {
        public static readonly Color Canvas   = Color.FromArgb(0x16, 0x17, 0x1B);
        public static readonly Color Surface  = Color.FromArgb(0x1C, 0x1D, 0x22);
        public static readonly Color Raised   = Color.FromArgb(0x24, 0x25, 0x2B);
        public static readonly Color Rule     = Color.FromArgb(0x2E, 0x2F, 0x36);
        public static readonly Color Ink      = Color.FromArgb(0xE9, 0xE9, 0xEE);
        public static readonly Color Dim      = Color.FromArgb(0xA3, 0xA4, 0xAE);
        public static readonly Color Mute     = Color.FromArgb(0x77, 0x79, 0x84);
        public static readonly Color Violet   = Color.FromArgb(0x7A, 0x6E, 0xF0);
        public static readonly Color Ok       = Color.FromArgb(0x4E, 0xC0, 0x8A);
        public static readonly Color Amber    = Color.FromArgb(0xE0, 0xA0, 0x46);
        // The only red in the product. It is for failure, and nothing else -
        // not for an About box.
        public static readonly Color Bad      = Color.FromArgb(0xE8, 0x77, 0x5F);

        public static Font H1   = new Font("Segoe UI", 15.5f, FontStyle.Regular);
        public static Font H2   = new Font("Segoe UI", 11.5f, FontStyle.Regular);
        public static Font Body = new Font("Segoe UI", 9.5f,  FontStyle.Regular);
        public static Font Sm   = new Font("Segoe UI", 8.5f,  FontStyle.Regular);
        public static Font Strong = new Font("Segoe UI", 10f, FontStyle.Bold);
        public static Font Mono = new Font("Consolas", 9f, FontStyle.Regular);
    }

    enum State { Disconnected, Connecting, Connected, Dropped }

    // ------------------------------------------------------------- painting
    static class Draw
    {
        public static GraphicsPath Round(Rectangle r, int radius)
        {
            var p = new GraphicsPath();
            int d = radius * 2;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        /// The mark, drawn rather than loaded from a bitmap. The shipped agent
        /// uses a light-background raster on a dark card, which is why its
        /// strapline all but disappears and the sphere carries a dark halo.
        public static void Mark(Graphics g, int x, int y, int size, Color ring, Color core)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var pen = new Pen(ring, Math.Max(1.4f, size / 11f)))
                g.DrawEllipse(pen, x, y, size, size);
            float inner = size * 0.42f;
            using (var b = new SolidBrush(core))
                g.FillEllipse(b, x + (size - inner) / 2f, y + (size - inner) / 2f, inner, inner);
        }

        /// Shields for the tray. The four states differ in silhouette as well
        /// as colour, so they still read at 16 pixels and without hue.
        public static Icon TrayIcon(State s, int px)
        {
            var bmp = new Bitmap(px, px);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);
                float pad = px * 0.14f;
                float w = px - pad * 2, h = px - pad * 1.4f;
                float x0 = pad, y0 = pad * 0.7f;
                var pts = new PointF[] {
                    new PointF(x0 + w / 2, y0),
                    new PointF(x0 + w,     y0 + h * 0.20f),
                    new PointF(x0 + w,     y0 + h * 0.55f),
                    new PointF(x0 + w / 2, y0 + h),
                    new PointF(x0,         y0 + h * 0.55f),
                    new PointF(x0,         y0 + h * 0.20f)
                };
                float stroke = Math.Max(1.6f, px * 0.075f);

                if (s == State.Connected)
                {
                    using (var b = new SolidBrush(T.Ok)) g.FillPolygon(b, pts);
                    using (var p = new Pen(Color.White, Math.Max(1.8f, px * 0.09f))
                                   { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                        g.DrawLines(p, new PointF[] {
                            new PointF(px * 0.36f, px * 0.52f),
                            new PointF(px * 0.46f, px * 0.62f),
                            new PointF(px * 0.65f, px * 0.40f) });
                }
                else if (s == State.Connecting)
                {
                    using (var p = new Pen(T.Amber, stroke) { LineJoin = LineJoin.Round })
                        g.DrawPolygon(p, pts);
                    using (var b = new SolidBrush(T.Amber))
                        g.FillEllipse(b, px * 0.41f, px * 0.41f, px * 0.18f, px * 0.18f);
                }
                else if (s == State.Dropped)
                {
                    using (var b = new SolidBrush(T.Bad)) g.FillPolygon(b, pts);
                    using (var p = new Pen(Color.White, Math.Max(1.8f, px * 0.09f)) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                    {
                        g.DrawLine(p, px * 0.38f, px * 0.38f, px * 0.62f, px * 0.62f);
                        g.DrawLine(p, px * 0.62f, px * 0.38f, px * 0.38f, px * 0.62f);
                    }
                }
                else
                {
                    using (var p = new Pen(T.Mute, stroke) { LineJoin = LineJoin.Round })
                        g.DrawPolygon(p, pts);
                }
            }
            return Icon.FromHandle(bmp.GetHicon());
        }
    }

    // ------------------------------------------------------------- controls
    /// A button that is drawn, because the stock WinForms button cannot be
    /// made to sit in a dark panel without looking like a mistake.
    class Btn : Control
    {
        public Color Fill = T.Raised, Ink = T.Ink, Edge = Color.Transparent;
        bool hot;
        public Btn(string text, int w, int h) { Text = text; Size = new Size(w, h); Cursor = Cursors.Hand;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true); }
        protected override void OnTextChanged(EventArgs e) { Invalidate(); base.OnTextChanged(e); }
        protected override void OnMouseEnter(EventArgs e) { hot = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hot = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            using (var path = Draw.Round(r, 6))
            {
                var f = hot ? ControlPaint.Light(Fill, 0.12f) : Fill;
                using (var b = new SolidBrush(f)) g.FillPath(b, path);
                if (Edge != Color.Transparent) using (var p = new Pen(Edge)) g.DrawPath(p, path);
            }
            TextRenderer.DrawText(g, Text, T.Body, r, Ink,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    /// A text field with a label above it and room for an error below, which
    /// is the part the shipped sign-in card does not reserve - so an error
    /// there shoves the button down the screen.
    class Field : Panel
    {
        public TextBox Box = new TextBox();
        Label lbl = new Label(), err = new Label();
        public Field(string label, bool password, int w)
        {
            // The label, the box and the error each get their own band. The
            // error band is reserved whether or not there is an error, which
            // is why nothing below it moves when one appears.
            Size = new Size(w, 92); BackColor = Color.Transparent;
            lbl.Text = label; lbl.Font = T.Sm; lbl.ForeColor = T.Dim;
            lbl.AutoSize = true; lbl.Location = new Point(0, 0);
            Box.BorderStyle = BorderStyle.FixedSingle; Box.Font = T.Body;
            Box.BackColor = T.Raised; Box.ForeColor = T.Ink;
            Box.Location = new Point(0, 22); Box.Size = new Size(w, 28);
            if (password) Box.UseSystemPasswordChar = true;
            err.Font = T.Sm; err.ForeColor = T.Bad; err.AutoSize = false;
            err.Size = new Size(w, 34); err.Location = new Point(0, 56); err.Text = "";
            Controls.AddRange(new Control[] { lbl, Box, err });
        }
        public void ShowError(string m) { err.Text = m; Box.BackColor = Color.FromArgb(0x2A, 0x1E, 0x1E); }
        public void Clear() { err.Text = ""; Box.BackColor = T.Raised; }
    }

    /// A frameless window with our own title bar, so the chrome matches the
    /// content instead of the 2005 grey the shipped setup uses.
    class Sheet : Form
    {
        protected Label TitleLabel = new Label();
        public Sheet(string title, int w, int h)
        {
            FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(w, h); BackColor = T.Canvas; ForeColor = T.Ink; Font = T.Body;
            ShowInTaskbar = true; DoubleBuffered = true;

            var bar = new Panel { Dock = DockStyle.Top, Height = 38, BackColor = T.Surface };
            TitleLabel.Text = title; TitleLabel.Font = T.Body; TitleLabel.ForeColor = T.Dim;
            TitleLabel.AutoSize = true; TitleLabel.Location = new Point(40, 11);
            var close = new Btn("✕", 34, 24) { Fill = Color.Transparent, Ink = T.Dim };
            close.Location = new Point(w - 44, 7);
            close.Click += (s, e) => Hide();
            bar.Controls.Add(TitleLabel); bar.Controls.Add(close);
            bar.Paint += (s, e) => Draw.Mark(e.Graphics, 14, 11, 16, T.Violet, T.Ink);
            bar.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { Native.ReleaseCapture(); Native.SendMessage(Handle, 0xA1, 0x2, 0); } };
            TitleLabel.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { Native.ReleaseCapture(); Native.SendMessage(Handle, 0xA1, 0x2, 0); } };
            Controls.Add(bar);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var p = new Pen(T.Rule)) e.Graphics.DrawRectangle(p, 0, 0, Width - 1, Height - 1);
        }
    }

    static class Native
    {
        [DllImport("user32.dll")] public static extern bool ReleaseCapture();
        [DllImport("user32.dll")] public static extern int SendMessage(IntPtr h, int msg, int wp, int lp);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("Shcore.dll")] public static extern int SetProcessDpiAwareness(int v);
    }
}
