/**
 * QR rendering.
 *
 * Uses the `qrcode` package only for the encoding — Reed-Solomon error
 * correction, mask selection, version sizing — and draws the SVG here.
 *
 * The package's `toString` takes a callback and resolves asynchronously even
 * when it looks synchronous, which silently yields an empty string if you
 * read the result immediately. `create()` is genuinely synchronous and hands
 * back the module bitmap, so the component can render without awaiting.
 */
import QRCode from 'qrcode'

const cache = new Map()

/**
 * Inline SVG for a QR code. Cached per text+scale.
 * @param {string} text  the otpauth:// URI
 * @param {number} scale pixels per module
 */
export function qrSvg (text, scale = 5) {
  if (!text) return ''
  const key = text + '|' + scale
  if (cache.has(key)) return cache.get(key)

  let qr
  try {
    qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  } catch {
    return ''
  }

  const size = qr.modules.size
  const data = qr.modules.data
  const quiet = 2
  const dim = (size + quiet * 2) * scale

  // One path for every dark module — far smaller than one <rect> each, and it
  // renders identically.
  let d = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) {
        d += `M${(x + quiet) * scale} ${(y + quiet) * scale}h${scale}v${scale}h-${scale}z`
      }
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="QR code for authenticator enrolment">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<path d="${d}" fill="#1f2023"/>` +
    `</svg>`

  cache.set(key, svg)
  return svg
}

export default qrSvg
