// The installer: four steps, a rail that carries progress, one task a screen.
// ---------------------------------------------------------------------------
// Four and not six, because the research says 3–7 and the fewest that work.
// There is no components step — there are no components. There is no licence
// screen, because a screen whose only job is to be dismissed teaches people to
// dismiss screens; the licence is a link on Welcome, where it is readable
// rather than ceremonial.
//
// The rail is InstallAnywhere's pattern and the UI Design Daily concept's:
// progress beside the content rather than under it. It answers "how much
// longer" without being asked, and gives the brand somewhere to sit that is
// not on top of the content — which is what goes wrong in the shipped
// installer, where the logo sits in a white band because it is a
// light-background raster.
// ---------------------------------------------------------------------------

using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace InstaSafeAgent
{
    class Installer : Sheet
    {
        static readonly string[] STEPS = { "Welcome", "Workspace", "Install", "Done" };
        const int RAIL = 208, W = 680, H = 460;

        int step = 0;
        Panel body = new Panel();
        Btn back, next, cancel;
        Field ws;
        Label headline = new Label(), blurb = new Label();
        Panel progressHost = new Panel();
        Label progressWhat = new Label();
        Panel facts = new Panel();
        Timer march = new Timer();
        int pct = 0, phase = 0;
        Action onFinished;

        static readonly string[] PHASES = {
            "Copying files",
            "Adding the network adapter",
            "Starting the background service"
        };

        public Installer(Action finished) : base("", W, H, false)
        {
            onFinished = finished;
            Bar.Visible = false;

            body.Location = new Point(RAIL, 0);
            body.Size = new Size(W - RAIL, H);
            body.BackColor = Color.Transparent;
            Controls.Add(body);

            headline.Font = T.H1; headline.ForeColor = T.Ink;
            headline.AutoSize = false; headline.Size = new Size(W - RAIL - 88, 40);
            headline.Location = new Point(48, 52);

            blurb.Font = T.Body; blurb.ForeColor = T.Dim;
            blurb.AutoSize = false; blurb.Size = new Size(W - RAIL - 88, 66);
            blurb.Location = new Point(48, 98);

            ws = new Field("Workspace address", false, W - RAIL - 96) { Location = new Point(48, 178), Visible = false };
            ws.Box.Text = "veno.instasafe.com";

            progressHost.Location = new Point(48, 184);
            progressHost.Size = new Size(W - RAIL - 96, 10);
            progressHost.BackColor = Color.Transparent;
            progressHost.Visible = false;
            progressHost.Paint += PaintProgress;

            progressWhat.Font = T.Small; progressWhat.ForeColor = T.Dim;
            progressWhat.AutoSize = false; progressWhat.Size = new Size(W - RAIL - 96, 20);
            progressWhat.Location = new Point(48, 202); progressWhat.Visible = false;

            // Welcome has room, and the honest use of it is saying what the
            // install will change — a network adapter and a background service
            // are things people are entitled to know about before they agree.
            facts.Location = new Point(48, 176);
            facts.Size = new Size(W - RAIL - 92, 188);
            facts.BackColor = Color.Transparent;
            facts.Paint += PaintFacts;

            back = new Btn("Back", 96, 36) { Fill = Color.Transparent, Edge = T.Rule, Ink = T.Dim };
            back.Location = new Point(48, H - 74);
            back.Click += (s, e) => Go(step - 1);

            next = new Btn("Get started", 150, 36) { Fill = T.Violet, Ink = Color.White };
            next.Location = new Point(W - RAIL - 198, H - 74);
            next.Click += (s, e) => Advance();

            body.Controls.AddRange(new Control[] { headline, blurb, facts, ws, progressHost, progressWhat, back, next });

            // Cancel sits apart from the forward path, on the rail, so it is
            // never the thing next to Next.
            cancel = new Btn("Cancel", 72, 28) { Fill = Color.Transparent, Ink = T.Mute, Radius = 5 };
            cancel.Location = new Point(20, H - 50);
            Controls.Add(cancel);
            cancel.BringToFront();
            cancel.Click += (s, e) => OnClose();

            march.Interval = 38;
            march.Tick += March;

            Paint += PaintRail;
            Go(0);
        }

        protected override void OnClose()
        {
            if (step == 3) { Hide(); onFinished(); return; }
            Hide(); Application.Exit();
        }

        // ------------------------------------------------------------- rail
        void PaintRail(object sender, PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var p = Shape.RoundSide(new RectangleF(0, 0, RAIL, Height), T.RWindow, true))
            using (var b = new SolidBrush(T.Rail)) g.FillPath(b, p);
            using (var pen = new Pen(T.Rule)) g.DrawLine(pen, RAIL, 0, RAIL, Height);

            Brand.Lockup(g, new PointF(26, 30), 30, Brand.Orange, Brand.Purple, T.Ink);

            float y = 118;
            for (int i = 0; i < STEPS.Length; i++)
            {
                bool done = i < step, now = i == step;
                var dotC = done ? T.Violet : now ? T.Violet : Color.FromArgb(0xD6, 0xD6, 0xDE);

                if (i > 0)
                    using (var pen = new Pen(i <= step ? T.Violet : Color.FromArgb(0xDE, 0xDE, 0xE5), 1.6f))
                        g.DrawLine(pen, 38, y - 30, 38, y - 8);

                using (var b = new SolidBrush(dotC))
                {
                    if (now) g.FillEllipse(b, 31, y - 7, 14, 14);
                    else if (done) g.FillEllipse(b, 32, y - 6, 12, 12);
                    else g.FillEllipse(b, 33, y - 5, 10, 10);
                }
                if (now)
                    using (var b = new SolidBrush(T.Rail)) g.FillEllipse(b, 35, y - 3, 6, 6);
                if (done)
                    using (var pen = new Pen(Color.White, 1.8f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                        g.DrawLines(pen, new[] { new PointF(35f, y), new PointF(37.4f, y + 2.6f), new PointF(41.5f, y - 2.6f) });

                TextRenderer.DrawText(g, STEPS[i], now ? T.Strong : T.Body,
                    new Rectangle(58, (int)y - 11, RAIL - 70, 22),
                    now ? T.Ink : (done ? T.Dim : T.Mute),
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter);

                y += 44;
            }

            TextRenderer.DrawText(g, "Step " + (step + 1) + " of " + STEPS.Length, T.Small,
                new Rectangle(26, Height - 86, RAIL - 40, 20), T.Mute, TextFormatFlags.Left);
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
            ws.Visible = step == 1;
            facts.Visible = step == 0 || step == 3;
            progressHost.Visible = progressWhat.Visible = step == 2;
            back.Visible = step == 1;
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
                    headline.Text = "Which workspace?";
                    blurb.Text = "Your IT team gave you an address — usually your company name "
                               + "followed by .instasafe.com.";
                    next.Text = "Install"; next.Width = 120;
                    break;
                case 2:
                    headline.Text = "Installing";
                    blurb.Text = "This takes about a minute. You can leave it running.";
                    pct = 0; phase = 0; progressWhat.Text = PHASES[0];
                    march.Start();
                    break;
                case 3:
                    headline.Text = "You're all set";
                    blurb.Text = "Installed, and it starts with this computer. "
                               + "Worth doing next:";
                    next.Text = "Sign in"; next.Width = 120;
                    break;
            }
            // At Done there is nothing left to cancel; the same button just
            // closes the window.
            cancel.Text = step == 3 ? "Close" : "Cancel";

            Reflow();
            next.Location = new Point(W - RAIL - next.Width - 48, H - 74);
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
            blurb.Height = size.Height + 4;

            int y = blurb.Bottom + 18;
            ws.Top = y;
            progressHost.Top = y + 6;
            progressWhat.Top = y + 24;
            facts.Top = y;
            facts.Height = Math.Max(60, (H - 92) - y);
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
                    g.FillEllipse(b, 1, y + 5, 7, 7);
                if (step == 0)
                    using (var pen = new Pen(Color.White, 1.4f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                        g.DrawLines(pen, new[] { new PointF(2.6f, y + 8.6f), new PointF(4.2f, y + 10.2f), new PointF(6.6f, y + 6.8f) });

                var r = new Rectangle(18, (int)y, facts.Width - 20, 40);
                TextRenderer.DrawText(g, row, T.Small, r, T.Dim,
                    TextFormatFlags.WordBreak | TextFormatFlags.Top);
                y += TextRenderer.MeasureText(row, T.Small, new Size(facts.Width - 20, 60),
                        TextFormatFlags.WordBreak).Height + 12;
            }
        }

        void Advance()
        {
            if (step == 1)
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
            if (step == 3) { Hide(); onFinished(); return; }
            Go(step + 1);
        }

        void March(object sender, EventArgs e)
        {
            pct += 1;
            int p = pct < 34 ? 0 : pct < 72 ? 1 : 2;
            if (p != phase) { phase = p; progressWhat.Text = PHASES[phase]; }
            progressHost.Invalidate();
            if (pct >= 100) { march.Stop(); Go(3); }
        }
    }
}
