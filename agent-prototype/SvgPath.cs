// An SVG path-data parser, so the agent can use the brand artwork itself.
// ---------------------------------------------------------------------------
// GDI+ has no notion of SVG, and the alternative — exporting the mark to PNGs
// at a dozen sizes and picking the nearest — is what makes the shipped agent's
// logo soft at every scale factor that is not 100%. Parsing the path data once
// keeps the mark resolution-free: the same curves fill a 16px tray icon and a
// 160px installer header.
//
// Covers the commands the brand files actually use: M m L l V C c S s A a Z.
// Not a general SVG implementation — H, Q and T are absent from the artwork,
// so they are absent here, and a path that used one would throw rather than
// draw something subtly wrong.
// ---------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;

namespace InstaSafeAgent
{
    static class SvgPath
    {
        public static GraphicsPath Parse(string d)
        {
            var path = new GraphicsPath(FillMode.Winding); // SVG's default fill-rule
            var t = new Lexer(d);

            PointF cur = PointF.Empty, start = PointF.Empty;
            PointF lastCtrl = PointF.Empty;
            char prev = ' ';
            bool open = false;
            char cmd;

            // The compiler here is the one that ships inside Windows, so this
            // file stays within C# 5: no inline `out` declarations, no throw
            // expressions, no interpolated strings.
            while (t.NextCommand(out cmd))
            {
                bool rel = char.IsLower(cmd);
                char up = char.ToUpperInvariant(cmd);

                do
                {
                    switch (up)
                    {
                        case 'M':
                        {
                            var p = t.Point(cur, rel);
                            if (open) path.CloseFigure();
                            path.StartFigure();
                            cur = start = p; open = true;
                            // A second coordinate pair after M is an implicit L.
                            up = 'L';
                            break;
                        }
                        case 'L':
                        {
                            var p = t.Point(cur, rel);
                            path.AddLine(cur, p); cur = p;
                            break;
                        }
                        case 'V':
                        {
                            float y = t.Number();
                            var p = new PointF(cur.X, rel ? cur.Y + y : y);
                            path.AddLine(cur, p); cur = p;
                            break;
                        }
                        case 'C':
                        {
                            var c1 = t.Point(cur, rel);
                            var c2 = t.Point(cur, rel);
                            var p  = t.Point(cur, rel);
                            path.AddBezier(cur, c1, c2, p);
                            lastCtrl = c2; cur = p;
                            break;
                        }
                        case 'S':
                        {
                            // The first control point mirrors the previous one,
                            // which is the whole point of the smooth variants.
                            var c1 = (prev == 'C' || prev == 'S')
                                   ? new PointF(2 * cur.X - lastCtrl.X, 2 * cur.Y - lastCtrl.Y)
                                   : cur;
                            var c2 = t.Point(cur, rel);
                            var p  = t.Point(cur, rel);
                            path.AddBezier(cur, c1, c2, p);
                            lastCtrl = c2; cur = p;
                            break;
                        }
                        case 'A':
                        {
                            float rx = t.Number(), ry = t.Number(), rot = t.Number();
                            bool large = t.Flag(), sweep = t.Flag();
                            var p = t.Point(cur, rel);
                            Arc(path, cur, p, rx, ry, rot, large, sweep);
                            cur = p;
                            break;
                        }
                        case 'Z':
                            path.CloseFigure();
                            cur = start; open = false;
                            break;
                        default:
                            throw new NotSupportedException("SVG path command '" + cmd + "' is not handled.");
                    }
                    prev = up;
                }
                while (up != 'Z' && t.MoreNumbers()); // repeated parameter sets
            }

            if (open) path.CloseFigure();
            return path;
        }

        /// <summary>
        /// Endpoint-parameterised arc → centre form → cubic segments, as laid
        /// out in the SVG specification's implementation notes (F.6.5).
        /// </summary>
        static void Arc(GraphicsPath path, PointF p0, PointF p1,
                        float rx, float ry, float rotDeg, bool large, bool sweep)
        {
            if (rx == 0 || ry == 0) { path.AddLine(p0, p1); return; }
            rx = Math.Abs(rx); ry = Math.Abs(ry);

            double phi = rotDeg * Math.PI / 180.0;
            double cosP = Math.Cos(phi), sinP = Math.Sin(phi);

            double dx2 = (p0.X - p1.X) / 2.0, dy2 = (p0.Y - p1.Y) / 2.0;
            double x1 =  cosP * dx2 + sinP * dy2;
            double y1 = -sinP * dx2 + cosP * dy2;

            // Scale the radii up if they are too small to span the endpoints.
            double lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
            if (lambda > 1) { double s = Math.Sqrt(lambda); rx = (float)(rx * s); ry = (float)(ry * s); }

            double num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
            double den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
            double co = Math.Sqrt(Math.Max(0, num / den));
            if (large == sweep) co = -co;

            double cx1 =  co * rx * y1 / ry;
            double cy1 = -co * ry * x1 / rx;
            double cx = cosP * cx1 - sinP * cy1 + (p0.X + p1.X) / 2.0;
            double cy = sinP * cx1 + cosP * cy1 + (p0.Y + p1.Y) / 2.0;

            double th0 = Angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
            double dth = Angle((x1 - cx1) / rx, (y1 - cy1) / ry,
                               (-x1 - cx1) / rx, (-y1 - cy1) / ry);
            if (!sweep && dth > 0) dth -= 2 * Math.PI;
            else if (sweep && dth < 0) dth += 2 * Math.PI;

            int segs = (int)Math.Ceiling(Math.Abs(dth) / (Math.PI / 2));
            double delta = dth / segs;
            double tq = 4.0 / 3.0 * Math.Tan(delta / 4.0);

            var from = p0;
            for (int i = 0; i < segs; i++)
            {
                double a = th0 + i * delta, b = a + delta;
                double ca = Math.Cos(a), sa = Math.Sin(a), cb = Math.Cos(b), sb = Math.Sin(b);

                var c1 = Map(cx, cy, rx, ry, cosP, sinP, ca - tq * sa, sa + tq * ca);
                var c2 = Map(cx, cy, rx, ry, cosP, sinP, cb + tq * sb, sb - tq * cb);
                var to = Map(cx, cy, rx, ry, cosP, sinP, cb, sb);

                path.AddBezier(from, c1, c2, to);
                from = to;
            }
        }

        static PointF Map(double cx, double cy, double rx, double ry,
                          double cosP, double sinP, double ux, double uy)
        {
            double x = rx * ux, y = ry * uy;
            return new PointF((float)(cosP * x - sinP * y + cx),
                              (float)(sinP * x + cosP * y + cy));
        }

        static double Angle(double ux, double uy, double vx, double vy)
        {
            double dot = ux * vx + uy * vy;
            double len = Math.Sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
            double a = Math.Acos(Math.Max(-1, Math.Min(1, dot / len)));
            return (ux * vy - uy * vx < 0) ? -a : a;
        }

        // ------------------------------------------------------------- lexer
        /// <summary>
        /// Path data is compressed hard by the exporter: "0,0,0" can mean three
        /// numbers or two flags and a number, "-.5" has no leading zero, and
        /// "1.5.5" is two numbers with one dot each. This reads it a character
        /// at a time rather than splitting on separators.
        /// </summary>
        class Lexer
        {
            readonly string s; int i;
            public Lexer(string d) { s = d; i = 0; }

            void Skip() { while (i < s.Length && (s[i] == ' ' || s[i] == ',' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++; }

            public bool NextCommand(out char cmd)
            {
                Skip();
                if (i < s.Length && char.IsLetter(s[i])) { cmd = s[i++]; return true; }
                cmd = ' ';
                if (i < s.Length) throw new FormatException("Expected a command at " + i);
                return false;
            }

            public bool MoreNumbers()
            {
                Skip();
                return i < s.Length && (char.IsDigit(s[i]) || s[i] == '-' || s[i] == '+' || s[i] == '.');
            }

            public float Number()
            {
                Skip();
                int st = i;
                if (i < s.Length && (s[i] == '-' || s[i] == '+')) i++;
                bool dot = false;
                while (i < s.Length)
                {
                    char c = s[i];
                    if (char.IsDigit(c)) { i++; }
                    else if (c == '.' && !dot) { dot = true; i++; }
                    else if ((c == 'e' || c == 'E') && i + 1 < s.Length) { i++; if (s[i] == '-' || s[i] == '+') i++; }
                    else break;
                }
                if (st == i) throw new FormatException("Expected a number at " + st);
                return float.Parse(s.Substring(st, i - st), CultureInfo.InvariantCulture);
            }

            /// Arc flags are single characters and may not be separated at all.
            public bool Flag()
            {
                Skip();
                char c = s[i++];
                if (c != '0' && c != '1') throw new FormatException("Expected an arc flag at " + (i - 1));
                return c == '1';
            }

            public PointF Point(PointF cur, bool rel)
            {
                float x = Number(), y = Number();
                return rel ? new PointF(cur.X + x, cur.Y + y) : new PointF(x, y);
            }
        }
    }
}
