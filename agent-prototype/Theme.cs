// Light theme, rounded chrome, and the shared controls.
// ---------------------------------------------------------------------------
// Light because an installer runs once, on a desktop, beside other installers
// that are all light — dark there reads as a different product. Rounded on the
// console's own progression (10 / 8 / 6) so the two feel related without the
// installer pretending to be the console.
// ---------------------------------------------------------------------------

using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace InstaSafeAgent
{
    enum State { Disconnected, Connecting, Connected, Dropped }

    static class T
    {
        public static readonly Color Canvas  = Color.FromArgb(0xFF, 0xFF, 0xFF);
        public static readonly Color Tint    = Color.FromArgb(0xF7, 0xF7, 0xFA);
        public static readonly Color Rail    = Color.FromArgb(0xF2, 0xF1, 0xF6);
        public static readonly Color Rule    = Color.FromArgb(0xE4, 0xE4, 0xEA);
        public static readonly Color Ink     = Color.FromArgb(0x1B, 0x1C, 0x20);
        public static readonly Color Dim     = Color.FromArgb(0x5A, 0x5C, 0x66);
        public static readonly Color Mute    = Color.FromArgb(0x8D, 0x8F, 0x9A);
        public static readonly Color Violet  = Color.FromArgb(0x5B, 0x4F, 0xD1);
        public static readonly Color Ok      = Color.FromArgb(0x1E, 0x8E, 0x5C);
        public static readonly Color Amber   = Color.FromArgb(0xB4, 0x74, 0x0E);
        public static readonly Color Bad     = Color.FromArgb(0xC0, 0x39, 0x2F);

        // The tray menu is the one dark surface. It hangs over the taskbar,
        // which is dark on a default Windows 11, and a white menu there is a
        // slab of light at the bottom of the screen every time you right-click.
        public static readonly Color MenuBg   = Color.FromArgb(0x17, 0x18, 0x1F);
        public static readonly Color MenuInk  = Color.FromArgb(0xED, 0xEE, 0xF3);
        public static readonly Color MenuDim  = Color.FromArgb(0x97, 0x9A, 0xA8);
        public static readonly Color MenuRule = Color.FromArgb(0x2B, 0x2D, 0x38);
        /// The hover fill. Violet is the interactive colour everywhere in this
        /// product, and at this value it reads as blue on a dark menu.
        public static readonly Color MenuHot  = Color.FromArgb(0x4F, 0x46, 0xE5);

        public static Font H1     = new Font("Segoe UI", 16f,   FontStyle.Regular);
        public static Font H2     = new Font("Segoe UI", 12f,   FontStyle.Regular);
        public static Font Body   = new Font("Segoe UI", 9.75f, FontStyle.Regular);
        public static Font Small  = new Font("Segoe UI", 8.5f,  FontStyle.Regular);
        public static Font Strong = new Font("Segoe UI", 9.75f, FontStyle.Bold);
        public static Font Mono   = new Font("Consolas", 9f,    FontStyle.Regular);

        public const int RWindow = 10, RCard = 8, RBtn = 6, RMenu = 10, RItem = 6;

        /// An 8-point spacing scale. Every gap in this application is one of
        /// these; "whatever looked right" is how the shipped agent ended up
        /// with a 3px gutter on one dialog and 19px on the next.
        public const int S1 = 4, S2 = 8, S3 = 12, S4 = 16, S5 = 24, S6 = 32, S7 = 48;
    }

    static class Shape
    {
        public static GraphicsPath Round(RectangleF r, float radius)
        {
            var p = new GraphicsPath();
            float d = radius * 2;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        /// Rounds only the corners that are asked for — the installer's rail
        /// needs the left two and square right, or it leaves a notch.
        public static GraphicsPath RoundSide(RectangleF r, float radius, bool left)
        {
            var p = new GraphicsPath();
            float d = radius * 2;
            if (left)
            {
                p.AddArc(r.X, r.Y, d, d, 180, 90);
                p.AddLine(r.Right, r.Y, r.Right, r.Bottom);
                p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            }
            else
            {
                p.AddLine(r.X, r.Y, r.Right - radius, r.Y);
                p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
                p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
                p.AddLine(r.Right - radius, r.Bottom, r.X, r.Bottom);
            }
            p.CloseFigure();
            return p;
        }
    }

    // ------------------------------------------------------------- controls
    class Btn : Control
    {
        public Color Fill = T.Tint, Ink = T.Ink, Edge = Color.Transparent;
        public float Radius = T.RBtn;
        bool hot, down;

        public Btn(string text, int w, int h)
        {
            Text = text; Size = new Size(w, h); Cursor = Cursors.Hand;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint
                   | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        }
        protected override void OnTextChanged(EventArgs e) { Invalidate(); base.OnTextChanged(e); }
        protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }
        protected override void OnMouseEnter(EventArgs e) { hot = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hot = down = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { down = true; Invalidate(); base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { down = false; Invalidate(); base.OnMouseUp(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1, Height - 1);
            using (var path = Shape.Round(r, Radius))
            {
                var f = Fill;
                if (!Enabled) f = Color.FromArgb(60, Fill);
                else if (down) f = ControlPaint.Dark(Fill, 0.04f);
                else if (hot) f = ControlPaint.Light(Fill, 0.10f);
                if (f.A > 0) using (var b = new SolidBrush(f)) g.FillPath(b, path);
                if (Edge.A > 0) using (var p = new Pen(Edge)) g.DrawPath(p, path);
            }
            var ink = Enabled ? Ink : Color.FromArgb(110, Ink);
            TextRenderer.DrawText(g, Text, T.Body, Rectangle.Round(r), ink,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    /// Label, box, and a reserved band for the error — reserved whether or not
    /// there is one, which is why nothing below it moves when an error appears.
    class Field : Panel
    {
        public TextBox Box = new TextBox();
        Label lbl = new Label(), err = new Label();
        Panel wrap = new Panel();
        bool bad;

        public Field(string label, bool password, int w)
        {
            Size = new Size(w, 90); BackColor = Color.Transparent;
            lbl.Text = label; lbl.Font = T.Small; lbl.ForeColor = T.Dim;
            lbl.AutoSize = true; lbl.Location = new Point(2, 0);

            wrap.Location = new Point(0, 20); wrap.Size = new Size(w, 34);
            wrap.BackColor = Color.Transparent;
            wrap.Paint += (s, e) =>
            {
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var p = Shape.Round(new RectangleF(0.5f, 0.5f, w - 1, 33), T.RCard))
                {
                    using (var b = new SolidBrush(T.Canvas)) g.FillPath(b, p);
                    using (var pen = new Pen(bad ? T.Bad : (Box.Focused ? T.Violet : T.Rule),
                                             Box.Focused || bad ? 1.6f : 1f)) g.DrawPath(pen, p);
                }
            };

            Box.BorderStyle = BorderStyle.None; Box.Font = T.Body;
            Box.BackColor = T.Canvas; Box.ForeColor = T.Ink;
            Box.Location = new Point(12, 9); Box.Size = new Size(w - 24, 20);
            if (password) Box.UseSystemPasswordChar = true;
            Box.GotFocus += (s, e) => wrap.Invalidate();
            Box.LostFocus += (s, e) => wrap.Invalidate();
            Box.TextChanged += (s, e) => { if (bad) Clear(); };
            wrap.Controls.Add(Box);

            err.Font = T.Small; err.ForeColor = T.Bad; err.AutoSize = false;
            err.Size = new Size(w, 32); err.Location = new Point(2, 58); err.Text = "";

            Controls.AddRange(new Control[] { lbl, wrap, err });
        }

        public void ShowError(string m) { bad = true; err.Text = m; wrap.Invalidate(); }
        public void Clear() { bad = false; err.Text = ""; wrap.Invalidate(); }
    }


    /// <summary>
    /// A scrolling block of text with the chrome taken off: no sunken 3D
    /// border, no system scrollbar, no grey field. Used for the licence and
    /// for the install log, which are the two places the shipped installer
    /// drops a raw Win32 control into an otherwise designed window.
    /// </summary>
    class ScrollText : Panel
    {
        string[] lines = new string[0];
        int top;                       // first visible line
        public bool Mono, Tail;        // Tail: stick to the bottom as lines arrive
        public int LineHeight = 19;

        public ScrollText(int w, int h)
        {
            Size = new Size(w, h);
            BackColor = Color.Transparent;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint
                   | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
            MouseWheel += (s, e) => ScrollBy(-e.Delta / 120 * 3);
            // A panel only receives the wheel when it has focus, and a reading
            // pane that steals focus is worse than one you have to click.
            MouseEnter += (s, e) => Focus();
            TabStop = true;
        }

        public void SetText(string text)
        {
            lines = Wrap(text);
            top = 0; Invalidate();
        }

        public void Append(string line)
        {
            var next = new string[lines.Length + 1];
            lines.CopyTo(next, 0);
            next[lines.Length] = line;
            lines = next;
            if (Tail) top = Math.Max(0, lines.Length - Visible_());
            Invalidate();
        }

        public void Clear() { lines = new string[0]; top = 0; Invalidate(); }

        int Visible_() { return Math.Max(1, (Height - 16) / LineHeight); }

        public void ScrollBy(int by)
        {
            int max = Math.Max(0, lines.Length - Visible_());
            int t = Math.Max(0, Math.Min(max, top + by));
            if (t == top) return;
            top = t; Invalidate();
        }

        string[] Wrap(string text)
        {
            var font = Mono ? T.Mono : T.Body;
            var outp = new System.Collections.Generic.List<string>();
            foreach (var para in text.Replace("\r", "").Split('\n'))
            {
                if (para.Length == 0) { outp.Add(""); continue; }
                var words = para.Split(' ');
                var cur = "";
                foreach (var w in words)
                {
                    var trial = cur.Length == 0 ? w : cur + " " + w;
                    if (TextRenderer.MeasureText(trial, font).Width > Width - 34 && cur.Length > 0)
                    { outp.Add(cur); cur = w; }
                    else cur = trial;
                }
                outp.Add(cur);
            }
            return outp.ToArray();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1, Height - 1);
            using (var p = Shape.Round(r, T.RCard))
            {
                using (var b = new SolidBrush(T.Tint)) g.FillPath(b, p);
                using (var pen = new Pen(T.Rule)) g.DrawPath(pen, p);
            }

            var font = Mono ? T.Mono : T.Body;
            int vis = Visible_(), y = 8;
            for (int i = top; i < lines.Length && i < top + vis; i++)
            {
                TextRenderer.DrawText(g, lines[i], font,
                    new Rectangle(14, y, Width - 28, LineHeight), T.Dim,
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
                y += LineHeight;
            }

            // The scrollbar is a hairline, drawn only when there is more to see.
            if (lines.Length > vis)
            {
                float track = Height - 16;
                float thumb = Math.Max(28f, track * vis / lines.Length);
                float at = 8 + (track - thumb) * top / Math.Max(1, lines.Length - vis);
                using (var p = Shape.Round(new RectangleF(Width - 9, at, 4, thumb), 2))
                using (var b = new SolidBrush(Color.FromArgb(0x9A, 0x9C, 0xA8))) g.FillPath(b, p);
            }
        }
    }


    /// <summary>
    /// The six-digit code box, matching the console's `.i-otp`: monospace,
    /// wide tracking, centred, one box rather than six. Six separate boxes
    /// look tidier in a mock-up and are worse to use — paste breaks, backspace
    /// is ambiguous, and screen readers announce six unlabelled fields.
    /// </summary>
    class OtpBox : Panel
    {
        public TextBox Box = new TextBox();
        Label err = new Label();
        bool bad;
        public event Action Complete;

        public OtpBox(int w)
        {
            Size = new Size(w, 92); BackColor = Color.Transparent;

            var wrap = new Panel { Location = new Point((w - 230) / 2, 0), Size = new Size(230, 52),
                                   BackColor = Color.Transparent };
            wrap.Paint += (s, e) =>
            {
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var p = Shape.Round(new RectangleF(0.5f, 0.5f, 229, 51), T.RCard))
                {
                    using (var b = new SolidBrush(T.Canvas)) g.FillPath(b, p);
                    using (var pen = new Pen(bad ? T.Bad : (Box.Focused ? T.Violet : T.Rule),
                                             Box.Focused || bad ? 1.6f : 1f)) g.DrawPath(pen, p);
                }
            };

            Box.BorderStyle = BorderStyle.None;
            Box.Font = new Font("Consolas", 19f);
            Box.TextAlign = HorizontalAlignment.Center;
            Box.BackColor = T.Canvas; Box.ForeColor = T.Ink;
            Box.MaxLength = 6;
            Box.Location = new Point(10, 12); Box.Size = new Size(210, 30);
            Box.HandleCreated += (s, e) => Native.Cue(Box, "000000");
            Box.GotFocus += (s, e) => wrap.Invalidate();
            Box.LostFocus += (s, e) => wrap.Invalidate();
            Box.KeyPress += (s, e) =>
            { if (!char.IsControl(e.KeyChar) && !char.IsDigit(e.KeyChar)) e.Handled = true; };
            Box.TextChanged += (s, e) =>
            {
                if (bad) { bad = false; err.Text = ""; wrap.Invalidate(); }
                if (Box.Text.Length == 6 && Complete != null) Complete();
            };
            wrap.Controls.Add(Box);

            err.Font = T.Small; err.ForeColor = T.Bad; err.AutoSize = false;
            err.TextAlign = ContentAlignment.TopCenter;
            err.Size = new Size(w, 34); err.Location = new Point(0, 58); err.Text = "";

            Controls.AddRange(new Control[] { wrap, err });
            Resize += (s, e) => wrap.Left = (Width - 230) / 2;
        }

        public void ShowError(string m) { bad = true; err.Text = m; Invalidate(true); }
        public void Reset() { bad = false; err.Text = ""; Box.Text = ""; Invalidate(true); }
    }

    /// A frameless, rounded window with our own title bar.
    class Sheet : Form
    {
        protected Label TitleLabel = new Label();
        protected Panel Bar = new Panel();

        public Sheet(string title, int w, int h, bool showMark = true)
        {
            FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(w, h); BackColor = T.Canvas; ForeColor = T.Ink; Font = T.Body;
            DoubleBuffered = true;

            Bar.Dock = DockStyle.Top; Bar.Height = 40; Bar.BackColor = Color.Transparent;
            TitleLabel.Text = title; TitleLabel.Font = T.Body; TitleLabel.ForeColor = T.Dim;
            TitleLabel.AutoSize = true; TitleLabel.Location = new Point(showMark ? 44 : 18, 12);

            var close = new Btn("✕", 32, 26) { Fill = Color.Transparent, Ink = T.Mute, Radius = 6 };
            close.Location = new Point(w - 42, 7);
            close.Click += (s, e) => OnClose();
            Bar.Controls.Add(TitleLabel); Bar.Controls.Add(close);
            if (showMark) Bar.Paint += (s, e) => Brand.MarkSmall(e.Graphics, new RectangleF(16, 12, 18, 18), Brand.Orange, Brand.Purple);

            EventHandler<MouseEventArgs> drag = (s, e) => { };
            Bar.MouseDown += (s, e) => Drag();
            TitleLabel.MouseDown += (s, e) => Drag();
            Controls.Add(Bar);

            Resize += (s, e) => ApplyRegion();
            ApplyRegion();
        }

        protected virtual void OnClose() { Hide(); }
        void Drag() { Native.ReleaseCapture(); Native.SendMessage(Handle, 0xA1, 0x2, 0); }

        /// Rounds the window itself, not just what is painted inside it.
        void ApplyRegion()
        {
            using (var p = Shape.Round(new RectangleF(0, 0, Width, Height), T.RWindow))
                Region = new Region(p);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var p = Shape.Round(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), T.RWindow))
            using (var pen = new Pen(T.Rule)) g.DrawPath(pen, p);
        }
    }

    static class Native
    {
        [DllImport("user32.dll")] public static extern bool ReleaseCapture();
        [DllImport("user32.dll")] public static extern int SendMessage(IntPtr h, int msg, int wp, int lp);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr SendMessageW(IntPtr h, int msg, IntPtr wp, string lp);

        /// EM_SETCUEBANNER. A placeholder drawn by the edit control itself,
        /// which disappears on the first keystroke and never ends up
        /// submitted as if it were a value.
        public static void Cue(TextBox b, string text)
        { SendMessageW(b.Handle, 0x1501, (IntPtr)1, text); }
        [DllImport("Shcore.dll")] public static extern int SetProcessDpiAwareness(int v);
    }
}
