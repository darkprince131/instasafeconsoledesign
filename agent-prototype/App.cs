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
    /// <summary>
    /// The same sign-in as the web console, in a window.
    ///
    /// The shipped agent opens an embedded WebView2 showing a page that looks
    /// nothing like the console: a different logo treatment, a different field
    /// style, an orange button where the console uses violet. Two sign-ins for
    /// one product is two products as far as anybody using it is concerned.
    /// This mirrors console/src/views/SignIn.vue step for step — lockup,
    /// large light title, both credentials at once, full-width primary, then
    /// the six-digit second factor — so the person who signed in on the web
    /// recognises this one.
    ///
    /// It also keeps going after the password. Signing in and connecting are
    /// two different things, and the agent is the only place you can watch the
    /// second one happen, so it shows its three steps rather than vanishing
    /// and leaving a tray icon to change colour on its own.
    /// </summary>
    class SignIn : Sheet
    {
        const int WW = 420, HH = 560, PAD = 44;
        int CW { get { return WW - PAD * 2; } }

        Field user, pass;
        OtpBox otp;
        Btn go, alt;
        Label h, sub, note, otpHint;
        Panel steps = new Panel();
        Timer run = new Timer();
        int stage = 0;          // 0 credentials · 1 second factor · 2 connecting
        int at = -1;            // which connect step is running
        Agent app;

        static readonly string[] CONNECT = {
            "Checking this device",
            "Opening the tunnel",
            "Assigning an address"
        };

        public SignIn(Agent a) : base("", WW, HH, false)
        {
            app = a;
            Bar.Visible = false;

            h = new Label { Font = new Font("Segoe UI", 18.5f), ForeColor = T.Ink,
                            AutoSize = false, Size = new Size(CW, 34), Location = new Point(PAD, 104) };
            sub = new Label { Font = T.Small, ForeColor = T.Mute,
                              AutoSize = false, Size = new Size(CW, 20), Location = new Point(PAD, 140) };

            user = new Field("Username or email", false, CW) { Location = new Point(PAD, 176) };
            user.Box.Text = "alen.joseph@veno.com";
            pass = new Field("Password", true, CW) { Location = new Point(PAD, 258) };

            otp = new OtpBox(CW) { Location = new Point(PAD, 186), Visible = false };
            otp.Complete += Submit;
            otpHint = new Label {
                Text = "Any six digits are accepted here. In the console the same step is "
                     + "real: it checks a TOTP code against the enrolled secret.",
                Font = T.Small, ForeColor = T.Mute, AutoSize = false,
                TextAlign = ContentAlignment.TopCenter,
                Size = new Size(CW, 52), Location = new Point(PAD, 284), Visible = false };

            steps.Location = new Point(PAD, 176);
            steps.Size = new Size(CW, 150);
            steps.BackColor = Color.Transparent;
            steps.Visible = false;
            steps.Paint += PaintSteps;

            go = new Btn("Sign in", CW, 40) { Fill = T.Violet, Ink = Color.White, Location = new Point(PAD, 364) };
            go.Click += (x, e) => Submit();

            alt = new Btn("Use a backup code instead", CW, 30)
                  { Fill = Color.Transparent, Ink = T.Violet, Location = new Point(PAD, 410), Visible = false };
            alt.Click += (x, e) => otp.ShowError("Backup codes are entered in the console, under Profile > Security.");

            note = new Label {
                Text = "By continuing you accept the Terms of Use and Privacy Policy.",
                Font = T.Small, ForeColor = T.Mute, AutoSize = false,
                Size = new Size(CW, 40), Location = new Point(PAD, 452) };

            var close = new Btn("✕", 32, 28) { Fill = Color.Transparent, Ink = T.Mute, Location = new Point(WW - 46, 14) };
            close.Click += (x, e) => { Hide(); Reset(); };

            Controls.AddRange(new Control[] { h, sub, user, pass, otp, otpHint, steps, go, alt, note, close });
            Paint += (x, e) => Brand.Lockup(e.Graphics, new PointF(PAD, 44), 30, Brand.Orange, Brand.Purple, T.Ink);
            MouseDown += (x, e) => { Native.ReleaseCapture(); Native.SendMessage(Handle, 0xA1, 0x2, 0); };

            run.Interval = 900;
            run.Tick += Step;
            Reset();
        }

        // ------------------------------------------------------- connecting
        void PaintSteps(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            float y = 4;
            for (int i = 0; i < CONNECT.Length; i++)
            {
                bool done = i < at, now = i == at;
                var c = done ? T.Ok : now ? T.Violet : Color.FromArgb(0xD6, 0xD6, 0xDE);

                using (var b = new SolidBrush(c)) g.FillEllipse(b, 0, y + 4, 16, 16);
                if (done)
                    using (var pen = new Pen(Color.White, 1.8f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                        g.DrawLines(pen, new[] { new PointF(4.6f, y + 12), new PointF(7f, y + 14.6f),
                                                 new PointF(11.4f, y + 9.2f) });
                else if (now)
                    using (var b = new SolidBrush(Color.White)) g.FillEllipse(b, 6, y + 10, 4, 4);

                if (i < CONNECT.Length - 1)
                    using (var pen = new Pen(i < at ? T.Ok : Color.FromArgb(0xDE, 0xDE, 0xE5), 1.6f))
                        g.DrawLine(pen, 8, y + 22, 8, y + 40);

                TextRenderer.DrawText(g, CONNECT[i], now ? T.Strong : T.Body,
                    new Rectangle(T.S4 + T.S3, (int)y + 2, steps.Width - 40, 20),
                    now ? T.Ink : (done ? T.Dim : T.Mute), TextFormatFlags.Left);
                y += 44;
            }
        }

        void Step(object sender, EventArgs e)
        {
            at++;
            if (at >= CONNECT.Length)
            {
                run.Stop();
                Hide(); Reset();
                app.Connected();
                return;
            }
            steps.Invalidate();
        }

        // ------------------------------------------------------------ flow
        void Submit()
        {
            if (stage == 0)
            {
                var v = user.Box.Text.Trim();
                if (v.Length == 0) { user.ShowError("Enter your username or email address."); return; }
                if (pass.Box.Text.Length == 0) { pass.ShowError("Enter your password."); return; }
                if (pass.Box.Text.Length < 4)
                {
                    pass.ShowError("That password was not accepted. Two attempts left before the account locks.");
                    return;
                }
                user.Clear(); pass.Clear();
                stage = 1; Lay();
                otp.Box.Focus();
                return;
            }

            if (stage == 1)
            {
                if (otp.Box.Text.Length < 6) { otp.ShowError("The code is six digits."); return; }
                stage = 2; at = -1; Lay();
                app.EnterConnecting();
                run.Start();
            }
        }

        void Lay()
        {
            bool cred = stage == 0, two = stage == 1, conn = stage == 2;

            user.Visible = pass.Visible = cred;
            otp.Visible = otpHint.Visible = alt.Visible = two;
            steps.Visible = conn;
            go.Visible = !conn;
            note.Visible = cred;

            if (cred)
            {
                h.Text = "Sign in"; sub.Text = "veno.instasafe.com";
                go.Text = "Sign in"; go.Top = 364;
            }
            else if (two)
            {
                h.Text = "Two-factor"; sub.Text = "Enter the six-digit code from your authenticator.";
                go.Text = "Verify"; go.Top = 352;
            }
            else
            {
                h.Text = "Connecting…"; sub.Text = user.Box.Text.Trim();
            }

            // Each stage asks for a different amount, so the window is a
            // different size. One box tall enough for the longest stage leaves
            // a third of it empty on the other two, which reads as a form that
            // has lost something.
            Fit(cred ? 516 : two ? 468 : 356);
            Invalidate(true);
        }

        /// Resizes about the window's own centre, so it does not appear to
        /// crawl up the screen as the stages shorten.
        void Fit(int h)
        {
            if (Height == h) return;
            int mid = Top + Height / 2;
            Height = h;
            Top = Math.Max(0, mid - h / 2);
        }

        public void Reset()
        {
            run.Stop();
            stage = 0; at = -1;
            pass.Box.Text = ""; otp.Reset();
            user.Clear(); pass.Clear();
            Lay();
        }
    }

    // ------------------------------------------------------------ the agent
    class Agent : ApplicationContext
    {
        NotifyIcon tray = new NotifyIcon();
        TrayPanel panel;
        SignIn signin;
        State state = State.Disconnected;
        ToolStripMenuItem trayStates;
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

            // One menu, four things: open it, change it, learn about it,
            // leave. The four demo states used to sit in the top level as four
            // sibling rows, which made the menu look like a debug switchboard;
            // they are one row with a submenu now.
            var menu = new ContextMenuStrip {
                BackColor = T.MenuBg, ForeColor = T.MenuInk,
                ShowImageMargin = false, DropShadowEnabled = true,
                Renderer = new DarkMenu(), Padding = new Padding(0, T.S1 + 2, 0, T.S1 + 2)
            };

            var open = new ToolStripMenuItem("Open InstaSafe");
            open.Click += (s, e) => { panel.Refresh(state, Since()); panel.ShowAtTray(); };

            var states = new ToolStripMenuItem("Connection");
            states.DropDown = new ToolStripDropDownMenu {
                BackColor = T.MenuBg, ForeColor = T.MenuInk,
                ShowImageMargin = false, DropShadowEnabled = true,
                Renderer = new DarkMenu(), Padding = new Padding(0, T.S1 + 2, 0, T.S1 + 2)
            };
            foreach (var pair in new[] {
                new object[] { "Connected",     State.Connected },
                new object[] { "Connecting…", State.Connecting },
                new object[] { "Dropped",       State.Dropped },
                new object[] { "Signed out",    State.Disconnected } })
            {
                var to = (State)pair[1];
                var row = new ToolStripMenuItem((string)pair[0]);
                row.Tag = to;                      // the row knows its own state
                row.Click += (s, e) => Set(to, true);
                states.DropDownItems.Add(row);
            }

            var setup = new ToolStripMenuItem("Run setup again");
            setup.Click += (s, e) => ShowInstaller();
            var about = new ToolStripMenuItem("About InstaSafe");
            about.Click += (s, e) => ShowAbout();
            var quit = new ToolStripMenuItem("Exit");
            quit.Click += (s, e) => Quit();

            menu.Items.AddRange(new ToolStripItem[] {
                open, new ToolStripSeparator(), states, setup,
                new ToolStripSeparator(), about, quit });

            foreach (ToolStripItem it in menu.Items) Size_(it);
            foreach (ToolStripItem it in states.DropDownItems) Size_(it);

            trayStates = states;
            tray.ContextMenuStrip = menu;

            Set(State.Disconnected, false);
            ShowInstaller();
        }

        /// Rows need room: 32px is the smallest that does not feel cramped
        /// beside a 10px corner radius, and every row is the same height so
        /// the hover highlight never changes shape as you move down.
        static void Size_(ToolStripItem it)
        {
            if (it is ToolStripSeparator) { it.Height = 9; return; }
            it.AutoSize = false;
            it.Size = new Size(248, 32);
            it.Font = T.Body;
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

        /// Connecting, with nothing driving it onward — the sign-in window is
        /// showing the steps and will say when they are done.
        public void EnterConnecting() { Set(State.Connecting, false); }

        /// Connecting, and it will get there on its own. This is the reconnect
        /// path: the toast's "Retry now", and the panel's "Reconnect".
        public void BeginConnect()
        {
            Set(State.Connecting, true);
            sim.Stop(); sim = new Timer { Interval = 2600 };
            sim.Tick += (s, e) => { sim.Stop(); Set(State.Connected, true); };
            sim.Start();
        }

        public void Connected() { Set(State.Connected, true); }

        void Set(State s, bool notify)
        {
            state = s;
            if (s == State.Connected) since = DateTime.Now;
            tray.Icon = Brand.Tray(s, 32);

            // The submenu says which state is current rather than only
            // offering four ways to change it.
            if (trayStates != null)
            {
                trayStates.Text = "Connection" + "    " + Word(s);
                foreach (ToolStripItem it in trayStates.DropDownItems)
                {
                    var row = it as ToolStripMenuItem;
                    // Matched on the row's own state, not on its position. The
                    // menu is ordered for reading and the enum is ordered by
                    // how the connection progresses, and they are not the same
                    // order — comparing indexes greyed out the wrong row.
                    if (row != null) row.Enabled = !s.Equals(row.Tag);
                }
            }

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

        static string Word(State s)
        {
            return s == State.Connected ? "Connected"
                 : s == State.Connecting ? "Connecting"
                 : s == State.Dropped ? "Dropped" : "Signed out";
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

    /// <summary>
    /// The tray menu, drawn.
    ///
    /// It hangs over the taskbar, which is near-black on a default Windows 11,
    /// so a white menu is a slab of light at the bottom of the screen every
    /// time you right-click. Dark, with rounded corners on both the menu and
    /// the hovered row, and the hover row carries the violet that means
    /// "interactive" everywhere else in this product.
    ///
    /// ToolStripProfessionalRenderer cannot do rounded rows or a rounded drop
    /// shadow, so this subclasses the renderer outright rather than feeding a
    /// colour table into one that will square the corners anyway.
    /// </summary>
    class DarkMenu : ToolStripRenderer
    {
        protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
            using (var p = Shape.Round(r, T.RMenu))
            {
                using (var b = new SolidBrush(T.MenuBg)) g.FillPath(b, p);
                using (var pen = new Pen(Color.FromArgb(0x3A, 0x3C, 0x48))) g.DrawPath(pen, p);
            }
            // The menu is a floating surface, so it is allowed its own shape.
            e.ToolStrip.Region = new Region(Shape.Round(
                new RectangleF(0, 0, e.ToolStrip.Width, e.ToolStrip.Height), T.RMenu));
        }

        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e) { }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (!e.Item.Selected && !((e.Item as ToolStripMenuItem) != null
                                      && ((ToolStripMenuItem)e.Item).DropDown.Visible)) return;
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(T.S1, 1, e.Item.Width - T.S1 * 2, e.Item.Height - 2);
            using (var p = Shape.Round(r, T.RItem))
            using (var b = new SolidBrush(e.Item.Enabled ? T.MenuHot : Color.FromArgb(0x25, 0x27, 0x31)))
                g.FillPath(b, p);
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.TextColor = !e.Item.Enabled ? Color.FromArgb(0x63, 0x66, 0x74)
                        : e.Item.Selected ? Color.White : T.MenuInk;
            e.TextFont = T.Body;
            // The stock renderer centres vertically but hugs the left edge of
            // its own margin; this keeps the text off the rounded corner.
            e.TextRectangle = new Rectangle(e.TextRectangle.X + T.S2, e.TextRectangle.Y,
                                            e.TextRectangle.Width, e.TextRectangle.Height);
            base.OnRenderItemText(e);
        }

        protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
        {
            var g = e.Graphics;
            int y = e.Item.Height / 2;
            using (var pen = new Pen(T.MenuRule))
                g.DrawLine(pen, T.S3, y, e.Item.Width - T.S3, y);
        }

        protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
        {
            // A chevron, not the stock solid triangle, and in the text colour
            // so it dims and brightens with the row.
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = e.ArrowRectangle;
            float x = r.X + r.Width - 10, y = r.Y + r.Height / 2f;
            using (var pen = new Pen(e.Item.Selected ? Color.White : T.MenuDim, 1.5f)
                             { StartCap = LineCap.Round, EndCap = LineCap.Round })
                g.DrawLines(pen, new[] { new PointF(x - 3, y - 4), new PointF(x + 1, y), new PointF(x - 3, y + 4) });
        }

        protected override void OnRenderImageMargin(ToolStripRenderEventArgs e) { }
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
