/**
 * Filter catalogues, read off the captured production forms.
 *
 * The four filter types are not variations of one form — each has its own
 * field set, taken from veno:
 *
 *   URL filter      profile_name, url_type (Exact | Wildcard | Regex), url
 *   Content filter  profile_name, category  (6 categories)
 *   File type       profile_name, category  (7 categories) -> extensions
 *   Domain list     profile_name, list      (a textarea, one per line)
 *
 * CATEGORY NAMES ARE EXACT. They were read from the captured <select>
 * options, not invented.
 *
 * EXTENSIONS_BY_CATEGORY IS NOT YET CONFIRMED. In the live console the
 * extension list is populated by companyadmin.js once a category is picked,
 * and the capture serialiser stripped the JavaScript, so the lists below are
 * sensible defaults rather than veno's actual values. The structure and the
 * behaviour are right; these specific strings need checking against the live
 * tenant before anybody treats them as authoritative.
 */

export const URL_TYPES = [
  { value: 'exact',    label: 'Exact Match',    hint: 'The address has to match character for character.' },
  { value: 'wildcard', label: 'Wildcard Match', hint: 'Use * for any run of characters: *.example.com/*' },
  { value: 'regex',    label: 'Regex Match',    hint: 'A full regular expression. Powerful, and the easiest of the three to get wrong.' }
]

/** Exact, from the captured content-filter <select>. */
export const CONTENT_CATEGORIES = [
  'Adult / Mature Content',
  'Security Risk',
  'Social / Lifestyle',
  'General Interest - Business',
  'General Interest - Personal',
  'Potentially Liable / Illegal'
]

/** Exact, from the captured file-type <select>. */
export const FILETYPE_CATEGORIES = [
  'Executables',
  'Media Files',
  'Documents',
  'Compressed Files',
  'Scripts',
  'Images',
  'Custom'
]

/**
 * Picking a category reveals its extensions, which is the behaviour the live
 * console has. `Custom` reveals nothing and lets you type your own.
 *
 * See the file header: these lists are defaults pending confirmation.
 */
export const EXTENSIONS_BY_CATEGORY = {
  'Executables':      ['exe', 'msi', 'dll', 'com', 'scr', 'cpl', 'jar', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'apk'],
  'Media Files':      ['mp3', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'wav', 'aac', 'flac', 'm4a', 'mpeg', 'webm'],
  'Documents':        ['doc', 'docx', 'docm', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx', 'pdf', 'rtf', 'odt', 'ods', 'csv'],
  'Compressed Files': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab', 'arj'],
  'Scripts':          ['ps1', 'bat', 'cmd', 'sh', 'vbs', 'js', 'py', 'pl', 'rb', 'php'],
  'Images':           ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'svg', 'webp', 'ico'],
  'Custom':           []
}

/** Why a category is usually filtered — shown as the field's hint. */
export const CATEGORY_NOTES = {
  'Executables':      'The category most worth blocking on an untrusted device. Also the one most likely to break a legitimate workflow.',
  'Media Files':      'Usually blocked for bandwidth rather than risk.',
  'Documents':        'Macro-enabled formats — docm, xlsm — carry most of the risk here.',
  'Compressed Files': 'An archive hides what is inside it from anything inspecting by extension.',
  'Scripts':          'Rarely needed by anyone outside engineering.',
  'Images':           'Low risk. Usually filtered for storage rather than security.',
  'Custom':           'Type your own extensions, without the dot.'
}
