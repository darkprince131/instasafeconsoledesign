// The agent's surfaces: tray panel, sign-in, toasts, dialogs, About.
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace InstaSafeAgent
{
    // ------------------------------------------------------------ the toast
    /// A notification we draw ourselves.
    ///
    /// Windows' own balloon would title this "InstaSafe-Agent.exe" — the
    /// filename, extension and all — because the shipped binary carries no
    /// version resource, and it would use the generic blue glyph because no
    /// AppUserModelID is registered. Both are one-line build fixes; drawing it
    /// here also lets the toast carry actions, which is the part that makes a
    /// notification useful rather than merely informative.
    class Toast : Form
    {
        Timer life = new Timer();
        public Toast(string title, string body, Color accent, string a1, string a2, Action onA1)
        {
            FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true;
            // Manual, or Windows places it at its own default and the toast
            // lands in the top-left corner over the desktop icons.
            StartPosition = FormStartPosition.Manual;
            Size = new Size(348, a1 == null ? 100 : 142);
            BackColor = T.Surface; DoubleBuffered = true;
            var wa = Screen.PrimaryScreen.WorkingArea;
            Location = new Point(wa.Right - Width - 16, wa.Bottom - Height - 16);

            var t = new Label { Text = title, Font = T.Strong, ForeColor = T.Ink, AutoSize = true, Location = new Point(58, 16) };
            var b = new Label { Text = body, Font = T.Body, ForeColor = T.Dim,
                                Location = new Point(58, 38), Size = new Size(274, 46), AutoSize = false };
            Controls.Add(t); Controls.Add(b);

            if (a1 != null)
            {
                var p = new Btn(a1, 92, 26) { Fill = T.Violet, Ink = Color.White, Location = new Point(58, 100) };
                p.Click += (s, e) => { Close(); if (onA1 != null) onA1(); };
                var q = new Btn(a2, 100, 26) { Fill = Color.Transparent, Edge = T.Rule, Ink = T.Dim, Location = new Point(158, 100) };
                q.Click += (s, e) => Close();
                Controls.Add(p); Controls.Add(q);
            }

            Paint += (s, e) =>
            {
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var pen = new Pen(T.Rule)) g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
                using (var br = new SolidBrush(Color.FromArgb(40, accent)))
                using (var path = Draw.Round(new Rectangle(16, 16, 30, 30), 8)) g.FillPath(br, path);
                Paint2(g, accent);
            };
            life.Interval = a1 == null ? 4000 : 9000;
            life.Tick += (s, e) => { life.Stop(); Close(); };
            life.Start();
        }
        void Paint2(Graphics g, Color accent) { Draw.Mark(g, 23, 23, 16, accent, accent); }
        protected override bool ShowWithoutActivation { get { return true; } }
    }

    // ------------------------------------------------------- the tray panel
    /// Replaces a four-item menu that never says whether you are connected.
    /// The state is the first thing in it, in words, with the detail under it.
    class TrayPanel : Form
    {
        Label head = new Label(), sub = new Label(), why = new Label();
        Panel dot = new Panel();
        Btn action;
        Agent app;

        public TrayPanel(Agent a)
        {
            app = a;
            FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true;
            StartPosition = FormStartPosition.Manual;
            Size = new Size(268, 258); BackColor = T.Surface; DoubleBuffered = true;

            dot.Size = new Size(9, 9); dot.Location = new Point(18, 24);
            dot.Paint += (s, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (var b = new SolidBrush(dot.BackColor)) e.Graphics.FillEllipse(b, 0, 0, 9, 9); };

            head.Font = new Font("Segoe UI", 12f); head.ForeColor = T.Ink;
            head.AutoSize = true; head.Location = new Point(34, 17);
            sub.Font = T.Sm; sub.ForeColor = T.Dim; sub.AutoSize = false;
            sub.Size = new Size(210, 16); sub.Location = new Point(34, 38);
            why.Font = T.Sm; why.ForeColor = T.Dim; why.AutoSize = false;
            why.Size = new Size(232, 32); why.Location = new Point(18, 62); why.Text = "";

            action = new Btn("Disconnect", 232, 30) { Location = new Point(18, 100), Fill = T.Raised };
            action.Click += (s, e) => { Hide(); app.PrimaryAction(); };

            Controls.AddRange(new Control[] { dot, head, sub, why, action });

            int y = 140;
            foreach (var item in new[] { "My applications", "Settings", "Help and diagnostics" })
            {
                var row = new Btn(item, 232, 28) { Fill = Color.Transparent, Ink = T.Dim, Location = new Point(18, y) };
                row.Click += (s, e) => { Hide(); app.Info(item); };
                Controls.Add(row); y += 30;
            }
            Deactivate += (s, e) => Hide();
            Paint += (s, e) => { using (var p = new Pen(T.Rule)) e.Graphics.DrawRectangle(p, 0, 0, Width - 1, Height - 1); };
        }

        public void Refresh(State s, string since)
        {
            switch (s)
            {
                case State.Connected:
                    dot.BackColor = T.Ok; head.Text = "Connected";
                    sub.Text = "veno · " + since + " · 10.130.9.3"; why.Text = "";
                    action.Text = "Disconnect"; action.Fill = T.Raised; action.Ink = T.Ink; break;
                case State.Connecting:
                    dot.BackColor = T.Amber; head.Text = "Connecting…";
                    sub.Text = "Checking this device"; why.Text = "";
                    action.Text = "Cancel"; action.Fill = Color.Transparent; action.Ink = T.Dim; break;
                case State.Dropped:
                    dot.BackColor = T.Bad; head.Text = "Not connected";
                    sub.Text = "The connection dropped at 15:21";
                    // What happened, why, and what next - the three parts the
                    // shipped agent has no room for anywhere.
                    why.Text = "Your network changed. InstaSafe will keep trying.";
                    action.Text = "Reconnect now"; action.Fill = T.Violet; action.Ink = Color.White; break;
                default:
                    dot.BackColor = T.Mute; head.Text = "Not connected";
                    sub.Text = "Sign in to reach company applications"; why.Text = "";
                    action.Text = "Connect"; action.Fill = T.Violet; action.Ink = Color.White; break;
            }
        }

        public void ShowAtTray()
        {
            var wa = Screen.PrimaryScreen.WorkingArea;
            Location = new Point(wa.Right - Width - 12, wa.Bottom - Height - 12);
            Show(); Activate();
        }
        protected override bool ShowWithoutActivation { get { return false; } }
    }

    // ---------------------------------------------------------- the sign-in
    /// The shipped screen says "Signin", titles itself "Web Authentication",
    /// and tells you that clicking a button named Next means agreeing to
    /// terms. All three are fixed here, and the error has its own reserved
    /// space so nothing moves when it appears.
    class SignIn : Sheet
    {
        Field user, pass;
        Btn go;
        Label h, s;
        int stage = 0;
        Agent app;

        public SignIn(Agent a) : base("Sign in to veno", 400, 470)
        {
            app = a;
            h = new Label { Text = "Sign in", Font = T.H1, ForeColor = T.Ink, AutoSize = true, Location = new Point(40, 78) };
            s = new Label { Text = "veno.instasafe.com", Font = T.Sm, ForeColor = T.Mute, AutoSize = true, Location = new Point(40, 110) };
            user = new Field("Email address", false, 320) { Location = new Point(40, 146) };
            pass = new Field("Password", true, 320) { Location = new Point(40, 146), Visible = false };
            go = new Btn("Continue", 320, 38) { Fill = T.Violet, Ink = Color.White, Location = new Point(40, 248) };
            go.Click += (x, e) => Next();

            var note = new Label {
                Text = "By continuing you accept the Terms of Use and Privacy Policy.",
                Font = T.Sm, ForeColor = T.Mute, Size = new Size(320, 44), Location = new Point(40, 298) };

            Controls.AddRange(new Control[] { h, s, user, pass, go, note });
            Paint += (x, e) => Draw.Mark(e.Graphics, 40, 420, 18, T.Violet, T.Dim);
        }

        void Next()
        {
            if (stage == 0)
            {
                if (user.Box.Text.Trim().Length == 0) { user.ShowError("Enter your email address."); return; }
                user.Clear(); user.Visible = false; pass.Visible = true;
                h.Text = "Hello, Alen"; s.Text = user.Box.Text; go.Text = "Sign in"; stage = 1;
                pass.Box.Focus(); return;
            }
            // Deliberately refuses a short password, so the error state is
            // reachable without a server. Anything 8+ signs in.
            if (pass.Box.Text.Length < 8)
            {
                pass.ShowError("That password was not accepted. Two attempts left.");
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

            tray.Icon = Draw.TrayIcon(State.Disconnected, 32);
            tray.Visible = true;
            tray.Text = "InstaSafe — not connected";

            // Left click opens the panel. Right click gets a short menu with
            // the states, so a reviewer can sit in any of them.
            tray.MouseUp += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    if (panel.Visible) panel.Hide();
                    else { panel.Refresh(state, Since()); panel.ShowAtTray(); }
                }
            };

            var menu = new ContextMenuStrip { BackColor = T.Surface, ForeColor = T.Ink, ShowImageMargin = false };
            menu.Renderer = new ToolStripProfessionalRenderer(new DarkMenu());
            menu.Items.Add("Open panel", null, (s, e) => { panel.Refresh(state, Since()); panel.ShowAtTray(); });
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
            signin.Show();
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
            tray.Icon = Draw.TrayIcon(s, 32);

            // Two lines, the answer first. The shipped tooltip is four lines
            // of label-colon-value and leads with the assigned IP.
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
                new Toast("InstaSafe", "Disconnected. Company applications are no longer reachable.",
                          T.Mute, null, null, null).Show();
        }

        public void Info(string what)
        {
            new Toast("InstaSafe", what + " would open here in the shipped agent.",
                      T.Violet, null, null, null).Show();
        }

        /// The shipped About box wears the critical-error red, has no OK
        /// button, and gives a version that matches neither the manifest nor
        /// Add/Remove Programs. One red, one version, one way out.
        void ShowAbout()
        {
            var f = new Sheet("About InstaSafe", 400, 258);
            f.Controls.Add(new Label { Text = "InstaSafe Agent", Font = T.H2, ForeColor = T.Ink, AutoSize = true, Location = new Point(40, 70) });
            f.Controls.Add(new Label { Text = "Version 3.0.5.0", Font = T.Mono, ForeColor = T.Dim, AutoSize = true, Location = new Point(40, 94) });
            f.Controls.Add(new Label {
                Text = "© 2026 InstaSafe Technologies Pvt Ltd\nTunnel by OpenVPN © 2002–2026 OpenVPN Inc.",
                Font = T.Sm, ForeColor = T.Mute, Size = new Size(320, 40), Location = new Point(40, 126) });
            var ok = new Btn("Close", 90, 30) { Fill = T.Raised, Location = new Point(270, 188) };
            ok.Click += (s, e) => f.Close();
            var sup = new Btn("Contact support", 150, 30) { Fill = Color.Transparent, Edge = T.Rule, Ink = T.Dim, Location = new Point(40, 188) };
            f.Controls.Add(ok); f.Controls.Add(sup);
            f.ShowDialog();
        }

        void Quit()
        {
            // Exiting cuts the user off from every internal application, so it
            // says so. The shipped menu exits on one click, next to About.
            var f = new Sheet("Exit InstaSafe", 400, 226);
            f.Controls.Add(new Label { Text = "Exit InstaSafe?", Font = T.H2, ForeColor = T.Ink, AutoSize = true, Location = new Point(40, 68) });
            f.Controls.Add(new Label {
                Text = "You'll lose access to company applications until you start it again.",
                Font = T.Body, ForeColor = T.Dim, Size = new Size(320, 40), Location = new Point(40, 94) });
            var cancel = new Btn("Stay connected", 140, 30) { Fill = T.Raised, Location = new Point(40, 158) };
            cancel.Click += (s, e) => f.Close();
            var quit = new Btn("Exit", 100, 30) { Fill = T.Bad, Ink = Color.White, Location = new Point(260, 158) };
            quit.Click += (s, e) => { tray.Visible = false; Environment.Exit(0); };
            f.Controls.Add(cancel); f.Controls.Add(quit);
            f.ShowDialog();
        }
    }

    class DarkMenu : ProfessionalColorTable
    {
        public override Color MenuItemSelected { get { return T.Raised; } }
        public override Color MenuItemSelectedGradientBegin { get { return T.Raised; } }
        public override Color MenuItemSelectedGradientEnd { get { return T.Raised; } }
        public override Color ToolStripDropDownBackground { get { return T.Surface; } }
        public override Color ImageMarginGradientBegin { get { return T.Surface; } }
        public override Color ImageMarginGradientMiddle { get { return T.Surface; } }
        public override Color ImageMarginGradientEnd { get { return T.Surface; } }
        public override Color MenuBorder { get { return T.Rule; } }
        public override Color SeparatorDark { get { return T.Rule; } }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            // Per-monitor DPI awareness. The shipped agent declares none, so
            // Windows bitmap-stretches it - which is the entire reason it
            // looks soft beside other applications.
            try { Native.SetProcessDpiAwareness(2); } catch { try { Native.SetProcessDPIAware(); } catch { } }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Agent());
        }
    }
}
