// The installer: the real product's steps, with the design fixed.
// ---------------------------------------------------------------------------
// The shipped installer is NSIS with the stock pages. Its order is:
//
//     Licence Agreement → Installing → Installation Complete
//
// and then the agent itself asks for the workspace address and a sign-in. This
// wizard keeps that order, because an installer that invents its own sequence
// is a different product, and adds the two steps that were happening outside
// the wizard with no progress shown at all.
//
//     Welcome · Licence · Installing · Workspace · Done
//
// Five steps, inside the 3–7 the research supports. What changes is not the
// sequence but the treatment:
//
//   · The progress rail sits beside the content, as in InstallAnywhere, so
//     "how much longer" is answered without being asked, and the brand has
//     somewhere to sit that is not on top of the content. In the shipped one
//     the logo is a light-background raster dropped into a white band.
//   · The install log is still there — it is genuinely useful when something
//     fails — but it is behind a disclosure, under a line of plain English,
//     instead of being the biggest thing on the screen.
//   · Cancel sits on the rail, away from Next, so it is never the thing
//     beside the forward path.
// ---------------------------------------------------------------------------

using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace InstaSafeAgent
{
    class Installer : Sheet
    {
        static readonly string[] STEPS = { "Welcome", "Licence", "Install", "Workspace", "Done" };
        const int RAIL = 216, W = 720, H = 536;
        const int PAD = 44;                       // content gutter
        int CW { get { return W - RAIL - PAD * 2; } }

        int step = 0;
        Panel body = new Panel();
        Btn back, next, cancel, details;
        Field ws;
        Label headline = new Label(), blurb = new Label();
        Panel progressHost = new Panel();
        Label progressWhat = new Label();
        Panel facts = new Panel();
        ScrollText licence, log;
        Timer march = new Timer();
        int pct = 0, phase = 0, logAt = 0;
        bool showLog;
        Action onFinished;

        /// What the user is told, in their own terms.
        static readonly string[] PHASES = {
            "Copying files",
            "Adding the network adapter",
            "Registering the background service",
            "Finishing up"
        };

        /// What the installer is actually doing, for the details pane. The
        /// first ten lines are the shipped installer's own log, read off a
        /// real run; the rest are the steps that follow it.
        static readonly string[] LOG = {
            @"Output folder: C:\Program Files\InstaSafe\bin",
            "Execute: taskkill /f /im InstaSafe-Agent.exe",
            "Extract: openvpn.exe... 100%",
            "Extract: instaservice.exe... 100%",
            "Extract: clientconfig.exe... 100%",
            "Extract: InstaSafe-Agent.exe... 100%",
            "Extract: InstaSafe-Agent.exe.manifest... 100%",
            "Extract: libcrypto-3-x64.dll... 100%",
            "Extract: libssl-3-x64.dll... 100%",
            "Extract: libpkcs11-helper-1.dll... 100%",
            "Install driver: tap-windows6 (NDIS 6.30)",
            "Create adapter: InstaSafe TAP Adapter",
            "Register service: InstaSafeConnectionService",
            "Set service start: Automatic (Delayed)",
            @"Create shortcut: InstaSafe Agent.lnk",
            "Completed"
        };

        const string LICENCE =
            "INSTASAFE END-USER SUBSCRIPTION AGREEMENT\n" +
            "\n" +
            "IMPORTANT PLEASE READ THE TERMS AND CONDITIONS OF THIS AGREEMENT " +
            "CAREFULLY BEFORE CONTINUING WITH THIS PROGRAM INSTALL: InstaSafe " +
            "End-User Subscription Agreement (\"EUSA\") is a legal agreement " +
            "between you (either an individual or a single entity) and InstaSafe " +
            "for the InstaSafe software product(s) identified above which may " +
            "include associated software components, media, printed materials, " +
            "and \"online\" or electronic documentation (\"SOFTWARE PRODUCT\"). " +
            "By installing, copying, or otherwise using the SOFTWARE PRODUCT, " +
            "you agree to be bound by the terms of this EUSA. This subscription " +
            "agreement represents the entire agreement concerning the program " +
            "between you and InstaSafe, and it supersedes any prior proposal, " +
            "representation, or understanding between the parties.\n" +
            "\n" +
            "1. GRANT OF LICENCE\n" +
            "\n" +
            "InstaSafe grants you a non-exclusive, non-transferable right to use " +
            "the SOFTWARE PRODUCT on the number of devices covered by your " +
            "organisation's active subscription, for as long as that " +
            "subscription remains in force.\n" +
            "\n" +
            "2. WHAT THE SOFTWARE DOES ON THIS DEVICE\n" +
            "\n" +
            "The SOFTWARE PRODUCT installs a network adapter and a background " +
            "service. While you are connected, traffic bound for your " +
            "organisation's applications is carried over an encrypted tunnel. " +
            "Traffic to everything else continues to use your ordinary " +
            "connection.\n" +
            "\n" +
            "3. RESTRICTIONS\n" +
            "\n" +
            "You may not reverse engineer, decompile, or disassemble the " +
            "SOFTWARE PRODUCT, except to the extent that such activity is " +
            "expressly permitted by applicable law notwithstanding this " +
            "limitation.\n" +
            "\n" +
            "4. TERMINATION\n" +
            "\n" +
            "Without prejudice to any other rights, InstaSafe may terminate this " +
            "EUSA if you fail to comply with its terms and conditions. In that " +
            "event you must destroy all copies of the SOFTWARE PRODUCT and all " +
            "of its component parts.\n" +
            "\n" +
            "5. NO WARRANTIES\n" +
            "\n" +
            "InstaSafe expressly disclaims any warranty for the SOFTWARE " +
            "PRODUCT, which is provided \"as is\" without any express or implied " +
            "warranty of any kind.\n";

        /// What was typed on the Workspace step, for whoever needs it next.
        public string Workspace { get { return ws.Box.Text.Trim(); } }

        public Installer(Action finished) : base("", W, H, false)
        {
            onFinished = finished;
            Bar.Visible = false;

            body.Location = new Point(RAIL, 0);
            body.Size = new Size(W - RAIL, H);
            body.BackColor = Color.Transparent;
            Controls.Add(body);

            headline.Font = T.H1; headline.ForeColor = T.Ink;
            headline.AutoSize = false; headline.Size = new Size(CW, 40);
            headline.Location = new Point(PAD, 52);

            blurb.Font = T.Body; blurb.ForeColor = T.Dim;
            blurb.AutoSize = false; blurb.Size = new Size(CW, 44);
            blurb.Location = new Point(PAD, 96);

            licence = new ScrollText(CW, 244) { Location = new Point(PAD, 160), Visible = false };
            licence.SetText(LICENCE);

            ws = new Field("Workspace address", false, CW) { Location = new Point(PAD, 160), Visible = false };
            ws.Box.Text = "veno.instasafe.com";

            progressHost.Location = new Point(PAD, 160);
            progressHost.Size = new Size(CW, 10);
            progressHost.BackColor = Color.Transparent;
            progressHost.Visible = false;
            progressHost.Paint += PaintProgress;

            progressWhat.Font = T.Small; progressWhat.ForeColor = T.Dim;
            progressWhat.AutoSize = false; progressWhat.Size = new Size(CW, 20);
            progressWhat.Location = new Point(PAD, 178); progressWhat.Visible = false;

            // The log is the shipped installer's whole screen. Here it is one
            // line of plain English with the log a click away — present for
            // the person debugging a failed install, absent for everyone else.
            details = new Btn("Show details", 112, 26)
                      { Fill = Color.Transparent, Ink = T.Violet, Radius = T.RBtn, Visible = false };
            details.Click += (s, e) =>
            {
                showLog = !showLog;
                details.Text = showLog ? "Hide details" : "Show details";
                log.Visible = showLog && step == 2;
            };

            log = new ScrollText(CW, 150) { Location = new Point(PAD, 236), Visible = false, Mono = true, Tail = true };
            log.LineHeight = 17;

            // Welcome and Done have room, and the honest use of it is saying
            // what the install will change. A network adapter and a background
            // service are things people are entitled to know about in advance.
            facts.Location = new Point(PAD, 160);
            facts.Size = new Size(CW + 4, 200);
            facts.BackColor = Color.Transparent;
            facts.Paint += PaintFacts;

            back = new Btn("Back", 96, 38) { Fill = Color.Transparent, Edge = T.Rule, Ink = T.Dim };
            back.Location = new Point(PAD, H - 80);
            back.Click += (s, e) => Go(step - 1);

            next = new Btn("Get started", 150, 38) { Fill = T.Violet, Ink = Color.White };
            next.Click += (s, e) => Advance();

            body.Controls.AddRange(new Control[] {
                headline, blurb, facts, licence, ws, progressHost, progressWhat, details, log, back, next });

            cancel = new Btn("Cancel", 76, 30) { Fill = Color.Transparent, Ink = T.Mute, Radius = 5 };
            cancel.Location = new Point(T.S5, H - 54);
            Controls.Add(cancel);
            cancel.BringToFront();
            cancel.Click += (s, e) => OnClose();

            march.Interval = 34;
            march.Tick += March;

            Paint += PaintRail;
            Go(0);
        }

        protected override void OnClose()
        {
            if (step == STEPS.Length - 1) { Hide(); onFinished(); return; }
            Hide(); Application.Exit();
        }

        // ------------------------------------------------------------- rail
        void PaintRail(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var p = Shape.RoundSide(new RectangleF(0, 0, RAIL, Height), T.RWindow, true))
            using (var b = new SolidBrush(T.Rail)) g.FillPath(b, p);
            using (var pen = new Pen(T.Rule)) g.DrawLine(pen, RAIL, 0, RAIL, Height);

            Brand.Lockup(g, new PointF(T.S6 - 4, T.S6), 30, Brand.Orange, Brand.Purple, T.Ink);

            float y = 132;
            for (int i = 0; i < STEPS.Length; i++)
            {
                bool done = i < step, now = i == step;
                var dotC = (done || now) ? T.Violet : Color.FromArgb(0xD6, 0xD6, 0xDE);

                if (i > 0)
                    using (var pen = new Pen(i <= step ? T.Violet : Color.FromArgb(0xDE, 0xDE, 0xE5), 1.6f))
                        g.DrawLine(pen, 36, y - 30, 36, y - 9);

                using (var b = new SolidBrush(dotC))
                {
                    if (now) g.FillEllipse(b, 29, y - 7, 14, 14);
                    else if (done) g.FillEllipse(b, 30, y - 6, 12, 12);
                    else g.FillEllipse(b, 31, y - 5, 10, 10);
                }
                if (now)
                    using (var b = new SolidBrush(T.Rail)) g.FillEllipse(b, 33, y - 3, 6, 6);
                if (done)
                    using (var pen = new Pen(Color.White, 1.8f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                        g.DrawLines(pen, new[] { new PointF(33f, y), new PointF(35.4f, y + 2.6f), new PointF(39.5f, y - 2.6f) });

                TextRenderer.DrawText(g, STEPS[i], now ? T.Strong : T.Body,
                    new Rectangle(58, (int)y - 11, RAIL - 70, 22),
                    now ? T.Ink : (done ? T.Dim : T.Mute),
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter);

                y += 44;
            }

            TextRenderer.DrawText(g, "Step " + (step + 1) + " of " + STEPS.Length, T.Small,
                new Rectangle(T.S6 - 4, Height - 90, RAIL - 44, 20), T.Mute, TextFormatFlags.Left);
        }

        void PaintProgress(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0, 1, progressHost.Width, 8);
            using (var p = Shape.Round(r, 4))
            using (var b = new SolidBrush(Color.FromArgb(0xE8, 0xE8, 0xEE))) g.FillPath(b, p);
            float w = Math.Max(8, progressHost.Width * pct / 100f);
            using (var p = Shape.Round(new RectangleF(0, 1, w, 8), 4))
            using (var b = new LinearGradientBrush(new RectangleF(0, 1, Math.Max(w, 1), 8),
                        T.Violet, Brand.Orange, LinearGradientMode.Horizontal)) g.FillPath(b, p);
        }

        // ------------------------------------------------------------ steps
        void Go(int i)
        {
            step = Math.Max(0, Math.Min(STEPS.Length - 1, i));

            licence.Visible = step == 1;
            ws.Visible = step == 3;
            facts.Visible = step == 0 || step == 4;
            progressHost.Visible = progressWhat.Visible = details.Visible = step == 2;
            log.Visible = step == 2 && showLog;
            back.Visible = step == 1 || step == 3;
            next.Visible = step != 2;

            switch (step)
            {
                case 0:
                    headline.Text = "Let's connect this computer";
                    blurb.Text = "A private route from this machine to your company's "
                               + "applications. It installs once, then stays out of the way.";
                    next.Text = "Get started"; next.Width = 150;
                    break;
                case 1:
                    headline.Text = "The licence";
                    blurb.Text = "The subscription agreement your organisation has already signed. "
                               + "Section 2 is the part that affects this computer.";
                    next.Text = "Agree and install"; next.Width = 172;
                    break;
                case 2:
                    headline.Text = "Installing";
                    blurb.Text = "About a minute. You can leave this running.";
                    pct = 0; phase = 0; logAt = 0;
                    progressWhat.Text = PHASES[0];
                    log.Clear();
                    march.Start();
                    break;
                case 3:
                    headline.Text = "Which workspace?";
                    blurb.Text = "Your IT team gave you an address — usually your company name "
                               + "followed by .instasafe.com.";
                    next.Text = "Continue"; next.Width = 130;
                    break;
                case 4:
                    headline.Text = "You're all set";
                    blurb.Text = "Installed, and it starts with this computer. Worth doing next:";
                    next.Text = "Sign in"; next.Width = 130;
                    break;
            }

            // At Done there is nothing left to cancel; the same button closes.
            cancel.Text = step == STEPS.Length - 1 ? "Close" : "Cancel";

            Reflow();
            next.Location = new Point(W - RAIL - next.Width - PAD, H - 80);
            Invalidate(); body.Invalidate();
        }

        /// <summary>
        /// Positions everything under the blurb from the blurb's measured
        /// height.
        ///
        /// Fixed Y values were wrong twice: once when the copy gained a line,
        /// and once on a 125% display, where the font grows but a hard-coded
        /// box does not, so the last line was simply cut off. Measuring costs
        /// nothing and cannot drift.
        /// </summary>
        void Reflow()
        {
            var size = TextRenderer.MeasureText(blurb.Text, T.Body,
                           new Size(blurb.Width, 400), TextFormatFlags.WordBreak);
            blurb.Height = size.Height + T.S1;

            int y = blurb.Bottom + T.S5;
            int floorY = H - 80 - T.S5;              // the button row

            ws.Top = y;
            licence.Top = y; licence.Height = Math.Max(120, floorY - y);
            progressHost.Top = y + 6;
            progressWhat.Top = y + T.S5;
            details.Location = new Point(PAD - 10, y + 52);
            log.Top = y + 86; log.Height = Math.Max(90, floorY - (y + 86));
            facts.Top = y; facts.Height = Math.Max(60, floorY - y);
        }

        static readonly string[] WILL = {
            "Adds a network adapter, so traffic for your applications is routed privately",
            "Installs a background service, so the connection survives a restart",
            "Asks for administrator permission once, in a moment"
        };
        static readonly string[] NEXT_UP = {
            "Install the agent on any other machine you work from",
            "Set up a second factor, so a password is not the only thing protecting you",
            "Save backup codes, in case your phone is lost"
        };

        void PaintFacts(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var rows = step == 0 ? WILL : NEXT_UP;
            float y = 2;
            foreach (var row in rows)
            {
                using (var b = new SolidBrush(step == 0 ? T.Ok : T.Violet))
                    g.FillEllipse(b, 1, y + 5, 8, 8);
                if (step == 0)
                    using (var pen = new Pen(Color.White, 1.4f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                        g.DrawLines(pen, new[] { new PointF(3f, y + 9.2f), new PointF(4.6f, y + 10.8f), new PointF(7.2f, y + 7.2f) });

                var r = new Rectangle(T.S5, (int)y, facts.Width - T.S5 - 4, 44);
                TextRenderer.DrawText(g, row, T.Small, r, T.Dim,
                    TextFormatFlags.WordBreak | TextFormatFlags.Top);
                y += TextRenderer.MeasureText(row, T.Small, new Size(facts.Width - T.S5 - 4, 60),
                        TextFormatFlags.WordBreak).Height + T.S3;
            }
        }

        void Advance()
        {
            if (step == 3)
            {
                // Validated here, at the step, with a message that says what to
                // do — not "Invalid input" after the fact.
                var v = ws.Box.Text.Trim();
                if (v.Length == 0) { ws.ShowError("Enter the address your IT team gave you."); return; }
                if (!v.Contains(".") || v.Contains(" "))
                { ws.ShowError("That does not look like an address. It should look like company.instasafe.com."); return; }
                if (!v.EndsWith("instasafe.com"))
                { ws.ShowError("That workspace did not answer. Check the address with your IT team."); return; }
                ws.Clear();
            }
            if (step == STEPS.Length - 1) { Hide(); onFinished(); return; }
            Go(step + 1);
        }

        void March(object sender, EventArgs e)
        {
            pct += 1;

            int p = pct < 30 ? 0 : pct < 58 ? 1 : pct < 84 ? 2 : 3;
            if (p != phase) { phase = p; progressWhat.Text = PHASES[phase]; }

            // The log keeps pace with the bar rather than arriving in a lump.
            int want = Math.Min(LOG.Length, pct * LOG.Length / 96);
            while (logAt < want) log.Append(LOG[logAt++]);

            progressHost.Invalidate();
            if (pct >= 100) { march.Stop(); Go(3); }   // Workspace, not Done
        }
    }
}
