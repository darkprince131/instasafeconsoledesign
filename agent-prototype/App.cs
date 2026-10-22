// Tray panel, sign-in, toasts, About — light, rounded, one brand mark.
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace InstaSafeAgent
{
    // ------------------------------------------------------------ the toast
    /// Windows' own balloon would title this "InstaSafe-Agent.exe" — the
    /// filename, extension and all — because the shipped binary carries no
    /// version resource, and would use the generic glyph because no
    /// AppUserModelID is registered. Drawing it also lets it carry actions,
    /// which is what makes a notification useful rather than merely informative.
    class Toast : Form
    {
        Timer life = new Timer();
        Color accent;

        public Toast(string title, string body, Color tone, string a1, string a2, Action onA1)
        {
            accent = tone;
            FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            Size = new Size(352, a1 == null ? 96 : 140);
            BackColor = T.Canvas; DoubleBuffered = true;
            var wa = Screen.PrimaryScreen.WorkingArea;
            Location = new Point(wa.Right - Width - 16, wa.Bottom - Height - 16);

            Controls.Add(new Label { Text = title, Font = T.Strong, ForeColor = T.Ink,
                                     AutoSize = true, Location = new Point(62, 18) });
            Controls.Add(new Label { Text = body, Font = T.Body, ForeColor = T.Dim, AutoSize = false,
                                     Location = new Point(62, 38), Size = new Size(272, 46) });

            if (a1 != null)
            {
                var p = new Btn(a1, 98, 28) { Fill = T.Violet, Ink = Color.White, Location = new Point(62, 96) };
                p.Click += (s, e) => { Close(); if (onA1 != null) onA1(); };
                var q = new Btn(a2, 106, 28) { Fill = Color.Transparent, Edge = T.Rule, Ink = T.Dim,
                                               Location = new Point(168, 96) };
                q.Click += (s, e) => Close();
                Controls.Add(p); Controls.Add(q);
            }

            Paint += (s, e) =>
            {
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var path = Shape.Round(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), T.RWindow))
                using (var pen = new Pen(T.Rule)) g.DrawPath(pen, path);
                Brand.MarkSmall(g, new RectangleF(20, 18, 30, 30), Brand.Orange, Brand.Purple);
                using (var b = new SolidBrush(accent))
                    g.FillEllipse(b, 42, 40, 9, 9);
                using (var k = new Pen(T.Canvas, 2f)) g.DrawEllipse(k, 42, 40, 9, 9);
            };

            Region = new Region(Shape.Round(new RectangleF(0, 0, Width, Height), T.RWindow));
            life.Interval = a1 == null ? 4500 : 9000;
            life.Tick += (s, e) => { life.Stop(); Close(); };
            life.Start();
        }
        protected override bool ShowWithoutActivation { get { return true; } }
    }

    // ------------------------------------------------------- the tray panel
    /// Replaces a four-item menu that never says whether you are connected.
    /// The state is the first thing in it, in words.
    class TrayPanel : Form
    {
        Label head = new Label(), sub = new Label(), why = new Label();
        Panel dot = new Panel();
        Btn action;
        Agent app;
        State state = State.Disconnected;

        public TrayPanel(Agent a)
        {
            app = a;
            FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            Size = new Size(280, 272); BackColor = T.Canvas; DoubleBuffered = true;

            dot.Size = new Size(10, 10); dot.Location = new Point(22, 60); dot.BackColor = Color.Transparent;
            dot.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                var c = state == State.Connected ? T.Ok : state == State.Connecting ? T.Amber
                      : state == State.Dropped ? T.Bad : T.Mute;
                using (var b = new SolidBrush(c)) e.Graphics.FillEllipse(b, 0, 0, 10, 10);
            };

            head.Font = new Font("Segoe UI", 13f); head.ForeColor = T.Ink;
            head.AutoSize = true; head.Location = new Point(38, 52);
            sub.Font = T.Small; sub.ForeColor = T.Dim; sub.AutoSize = false;
            sub.Size = new Size(218, 18); sub.Location = new Point(38, 75);
            why.Font = T.Small; why.ForeColor = T.Dim; why.AutoSize = false;
            why.Size = new Size(236, 32); why.Location = new Point(22, 98); why.Text = "";

            action = new Btn("Connect", 236, 34) { Location = new Point(22, 136), Fill = T.Violet, Ink = Color.White };
            action.Click += (s, e) => { Hide(); app.PrimaryAction(); };

            Controls.AddRange(new Control[] { dot, head, sub, why, action });

            int y = 180;
            foreach (var item in new[] { "My applications", "Settings", "Help and diagnostics" })
            {
                var row = new Btn(item, 236, 28) { Fill = Color.Transparent, Ink = T.Dim, Location = new Point(22, y) };
                row.Click += (s, e) => { Hide(); app.Info(item); };
                Controls.Add(row); y += 29;
            }

            Deactivate += (s, e) => Hide();
            Paint += (s, e) =>
            {
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var p = Shape.Round(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), T.RWindow))
                using (var pen = new Pen(T.Rule)) g.DrawPath(pen, p);
                Brand.Lockup(g, new PointF(22, 16), 22, Brand.Orange, Brand.Purple, T.Ink);
                using (var pen = new Pen(T.Rule)) g.DrawLine(pen, 14, 168, Width - 14, 168);
            };
            Region = new Region(Shape.Round(new RectangleF(0, 0, Width, Height), T.RWindow));
        }

        public void Refresh(State s, string since)
        {
            state = s;
            switch (s)
            {
                case State.Connected:
                    head.Text = "Connected"; sub.Text = "veno · " + since + " · 10.130.9.3";
                    why.Text = ""; action.Text = "Disconnect"; action.Fill = T.Tint; action.Ink = T.Ink; break;
                case State.Connecting:
                    head.Text = "Connecting…"; sub.Text = "Checking this device";
                    why.Text = ""; action.Text = "Cancel"; action.Fill = T.Tint; action.Ink = T.Dim; break;
                case State.Dropped:
                    head.Text = "Not connected"; sub.Text = "The connection dropped at 15:21";
                    why.Text = "Your network changed. InstaSafe will keep trying.";
                    action.Text = "Reconnect now"; action.Fill = T.Violet; action.Ink = Color.White; break;
                default:
                    head.Text = "Not connected"; sub.Text = "Sign in to reach your applications";
                    why.Text = ""; action.Text = "Connect"; action.Fill = T.Violet; action.Ink = Color.White; break;
            }
            dot.Invalidate();
        }

        public void ShowAtTray()
        {
            var wa = Screen.PrimaryScreen.WorkingArea;
            Location = new Point(wa.Right - Width - 12, wa.Bottom - Height - 12);
            Show(); Activate();
        }
    }

    // ---------------------------------------------------------- the sign-in
    class SignIn : Sheet
    {
        Field user, pass;
        Btn go;
        Label h, s;
        int stage = 0;
        Agent app;

        public SignIn(Agent a) : base("", 400, 480, false)
        {
            app = a;
            Bar.Visible = false;

            h = new Label { Text = "Sign in", Font = T.H1, ForeColor = T.Ink, AutoSize = true, Location = new Point(44, 112) };
            s = new Label { Text = "veno.instasafe.com", Font = T.Small, ForeColor = T.Mute, AutoSize = true, Location = new Point(44, 144) };
            user = new Field("Email address", false, 312) { Location = new Point(44, 180) };
            pass = new Field("Password", true, 312) { Location = new Point(44, 180), Visible = false };
            go = new Btn("Continue", 312, 38) { Fill = T.Violet, Ink = Color.White, Location = new Point(44, 282) };
            go.Click += (x, e) => Next();

            var note = new Label {
                Text = "By continuing you accept the Terms of Use and Privacy Policy.",
                Font = T.Small, ForeColor = T.Mute, Size = new Size(312, 40), Location = new Point(44, 332) };

            var close = new Btn("✕", 32, 26) { Fill = Color.Transparent, Ink = T.Mute, Location = new Point(354, 12) };
            close.Click += (x, e) => Hide();

            Controls.AddRange(new Control[] { h, s, user, pass, go, note, close });
            Paint += (x, e) => Brand.Lockup(e.Graphics, new PointF(44, 48), 28, Brand.Orange, Brand.Purple, T.Ink);
            MouseDown += (x, e) => { Native.ReleaseCapture(); Native.SendMessage(Handle, 0xA1, 0x2, 0); };
        }

        void Next()
        {
            if (stage == 0)
            {
                var v = user.Box.Text.Trim();
                if (v.Length == 0) { user.ShowError("Enter your email address."); return; }
                if (!v.Contains("@")) { user.ShowError("That is not an email address — it needs an @."); return; }
                user.Clear(); user.Visible = false; pass.Visible = true;
                h.Text = "Welcome back"; s.Text = v; go.Text = "Sign in"; stage = 1;
                pass.Box.Focus(); return;
            }
            if (pass.Box.Text.Length < 8)
            {
                pass.ShowError("That password was not accepted. Two attempts left before the account locks.");
                return;
            }
            pass.Clear(); Hide(); Reset(); app.BeginConnect();
        }

        public void Reset()
        {
            stage = 0; user.Visible = true; pass.Visible = false;
            user.Box.Text = ""; pass.Box.Text = ""; user.Clear(); pass.Clear();
            h.Text = "Sign in"; s.Text = "veno.instasafe.com"; go.Text = "Continue";
        }
    }

    // ------------------------------------------------------------ the agent
    class Agent : ApplicationContext
    {
        NotifyIcon tray = new NotifyIcon();
        TrayPanel panel;
        SignIn signin;
        State state = State.Disconnected;
        Timer sim = new Timer();
        DateTime since;

        public Agent()
        {
            panel = new TrayPanel(this);
            signin = new SignIn(this);

            tray.Icon = Brand.Tray(State.Disconnected, 32);
            tray.Visible = true;
            tray.Text = "InstaSafe — not connected";
            tray.MouseUp += (s, e) =>
            {
                if (e.Button != MouseButtons.Left) return;
                if (panel.Visible) panel.Hide();
                else { panel.Refresh(state, Since()); panel.ShowAtTray(); }
            };

            var menu = new ContextMenuStrip { BackColor = T.Canvas, ForeColor = T.Ink, ShowImageMargin = false };
            menu.Renderer = new ToolStripProfessionalRenderer(new LightMenu());
            menu.Items.Add("Open panel", null, (s, e) => { panel.Refresh(state, Since()); panel.ShowAtTray(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Run the installer again", null, (s, e) => ShowInstaller());
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Demo: connected", null, (s, e) => Set(State.Connected, true));
            menu.Items.Add("Demo: connecting", null, (s, e) => Set(State.Connecting, true));
            menu.Items.Add("Demo: dropped", null, (s, e) => Set(State.Dropped, true));
            menu.Items.Add("Demo: signed out", null, (s, e) => Set(State.Disconnected, true));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("About", null, (s, e) => ShowAbout());
            menu.Items.Add("Exit", null, (s, e) => Quit());
            tray.ContextMenuStrip = menu;

            Set(State.Disconnected, false);
            ShowInstaller();
        }

        void ShowInstaller()
        {
            var w = new Installer(() => { signin.Reset(); signin.Show(); signin.Activate(); });
            w.Show();
        }

        string Since()
        {
            if (state != State.Connected) return "";
            int m = (int)(DateTime.Now - since).TotalMinutes;
            return m < 1 ? "just now" : m + " min";
        }

        public void PrimaryAction()
        {
            if (state == State.Connected) { Set(State.Disconnected, true); return; }
            if (state == State.Dropped) { BeginConnect(); return; }
            if (state == State.Connecting) { Set(State.Disconnected, true); return; }
            signin.Reset(); signin.Show(); signin.Activate();
        }

        public void BeginConnect()
        {
            Set(State.Connecting, true);
            sim.Stop(); sim = new Timer { Interval = 2600 };
            sim.Tick += (s, e) => { sim.Stop(); Set(State.Connected, true); };
            sim.Start();
        }

        void Set(State s, bool notify)
        {
            state = s;
            if (s == State.Connected) since = DateTime.Now;
            tray.Icon = Brand.Tray(s, 32);

            // Two lines, the answer first. The shipped tooltip is four lines of
            // label-colon-value and leads with the assigned IP.
            tray.Text = s == State.Connected ? "Connected to veno\n10.130.9.3"
                      : s == State.Connecting ? "InstaSafe — connecting…"
                      : s == State.Dropped ? "InstaSafe — connection lost"
                      : "InstaSafe — not connected";

            if (panel.Visible) panel.Refresh(s, Since());
            if (!notify) return;

            if (s == State.Connected)
                new Toast("InstaSafe", "You're connected. Your applications are available.",
                          T.Ok, "Open", "Disconnect", () => Info("My applications")).Show();
            else if (s == State.Dropped)
                new Toast("InstaSafe", "Connection lost. Retrying automatically.",
                          T.Bad, "Retry now", "Get help", BeginConnect).Show();
            else if (s == State.Disconnected)
                new Toast("InstaSafe", "Disconnected. Your applications are no longer reachable.",
                          T.Mute, null, null, null).Show();
        }

        public void Info(string what)
        {
            new Toast("InstaSafe", what + " would open here in the shipped agent.",
                      T.Violet, null, null, null).Show();
        }

        /// The shipped About wears the critical-error red, has no OK button, and
        /// gives a version matching neither the manifest nor Add/Remove.
        void ShowAbout()
        {
            var f = new Sheet("About", 400, 272);
            f.Controls.Add(new Label { Text = "InstaSafe Agent", Font = T.H2, ForeColor = T.Ink, AutoSize = true, Location = new Point(44, 84) });
            f.Controls.Add(new Label { Text = "Version 3.0.5.0", Font = T.Mono, ForeColor = T.Dim, AutoSize = true, Location = new Point(44, 110) });
            f.Controls.Add(new Label {
                Text = "© 2026 InstaSafe Technologies Pvt Ltd\nTunnel by OpenVPN © 2002–2026 OpenVPN Inc.",
                Font = T.Small, ForeColor = T.Mute, Size = new Size(320, 40), Location = new Point(44, 142) });
            var ok = new Btn("Close", 96, 32) { Fill = T.Violet, Ink = Color.White, Location = new Point(260, 202) };
            ok.Click += (s, e) => f.Close();
            var sup = new Btn("Contact support", 150, 32) { Fill = Color.Transparent, Edge = T.Rule, Ink = T.Dim, Location = new Point(44, 202) };
            f.Controls.Add(ok); f.Controls.Add(sup);
            f.ShowDialog();
        }

        void Quit()
        {
            // Exiting cuts the user off from every internal application, so it
            // says so. The shipped menu exits on one click, next to About.
            var f = new Sheet("Exit InstaSafe", 400, 236);
            f.Controls.Add(new Label { Text = "Exit InstaSafe?", Font = T.H2, ForeColor = T.Ink, AutoSize = true, Location = new Point(44, 76) });
            f.Controls.Add(new Label {
                Text = "You'll lose access to your company applications until you start it again.",
                Font = T.Body, ForeColor = T.Dim, Size = new Size(316, 44), Location = new Point(44, 104) });
            var cancel = new Btn("Stay connected", 146, 32) { Fill = T.Violet, Ink = Color.White, Location = new Point(44, 166) };
            cancel.Click += (s, e) => f.Close();
            var quit = new Btn("Exit", 96, 32) { Fill = Color.Transparent, Edge = T.Rule, Ink = T.Bad, Location = new Point(260, 166) };
            quit.Click += (s, e) => { tray.Visible = false; Environment.Exit(0); };
            f.Controls.Add(cancel); f.Controls.Add(quit);
            f.ShowDialog();
        }
    }

    class LightMenu : ProfessionalColorTable
    {
        public override Color MenuItemSelected { get { return T.Tint; } }
        public override Color MenuItemSelectedGradientBegin { get { return T.Tint; } }
        public override Color MenuItemSelectedGradientEnd { get { return T.Tint; } }
        public override Color ToolStripDropDownBackground { get { return T.Canvas; } }
        public override Color ImageMarginGradientBegin { get { return T.Canvas; } }
        public override Color ImageMarginGradientMiddle { get { return T.Canvas; } }
        public override Color ImageMarginGradientEnd { get { return T.Canvas; } }
        public override Color MenuBorder { get { return T.Rule; } }
        public override Color SeparatorDark { get { return T.Rule; } }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            // Per-monitor DPI awareness. The shipped agent declares none, so
            // Windows bitmap-stretches it — the whole reason it looks soft.
            try { Native.SetProcessDpiAwareness(2); } catch { try { Native.SetProcessDPIAware(); } catch { } }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Agent());
        }
    }
}
