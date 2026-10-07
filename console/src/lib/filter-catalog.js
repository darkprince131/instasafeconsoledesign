/**
 * Filter catalogues, captured from velto's live forms.
 *
 * The four filter types are not variations of one form — each has its own
 * field set:
 *
 *   URL filter      profile_name, url_type (Exact | Wildcard | Regex), url
 *   Content filter  profile_name, category -> sub_categories (multi-select)
 *   File type       profile_name, category -> extensions     (multi-select)
 *   Domain list     profile_name, list (a textarea, one per line)
 *
 * Both cascades below are READ FROM VELTO, not inferred: the category select
 * was driven option by option and the dependent select read each time. The
 * earlier version of this file carried plausible-looking defaults, and they
 * were wrong in ways that mattered — `.bat` sat under Scripts when production
 * files it under Executables, and the lists were two to three times too long.
 *
 * Extensions keep their leading dot, because that is how production stores
 * and displays them (".exe", not "exe").
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
 * Category -> extensions. Captured from velto.
 *
 * Short lists, and narrower than they look: Documents offers no .doc, .rtf or
 * macro-enabled .docm, and Compressed Files no .iso. An admin who needs those
 * has to use Custom.
 */
export const EXTENSIONS_BY_CATEGORY = {
  'Executables':      ['.exe', '.bat', '.msi', '.com', '.scr'],
  'Media Files':      ['.mp4', '.mp3', '.avi', '.mov', '.mkv'],
  'Documents':        ['.pdf', '.docx', '.pptx', '.xls', '.xlsx'],
  'Compressed Files': ['.zip', '.rar', '.7z', '.tar', '.gz', '.xz'],
  'Scripts':          ['.js', '.py', '.sh', '.rb', '.php'],
  'Images':           ['.jpg', '.png', '.svg', '.bmp', '.webp'],
  'Custom':           []
}

/**
 * Content filter: category -> sub-categories. Captured from velto.
 *
 * This cascade was missing from this console entirely. The content filter is
 * not a six-way choice — the category only picks which of 49 sub-categories
 * you may then choose from, and the sub-category is what actually filters.
 * The list screen's third column is `Sub Categories`, not `Category`.
 */
export const SUBCATEGORIES_BY_CATEGORY = {
  'Adult / Mature Content': [
    'Pornography', 'Nudity and Risque', 'Sex Education', 'Abortion', 'Alcohol',
    'Dating', 'Gambling', 'Lingerie and Swimsuit', 'Marijuana',
    'Other Adult Materials', 'Tobacco', 'Weapons (Sales)'
  ],
  'Security Risk': [
    'Phishing', 'Dynamic DNS', 'Malicious Websites', 'Newly Observed Domain',
    'Spam URLs', 'Crypto Mining', 'Potentially Unwanted Program'
  ],
  'Social / Lifestyle': [
    'Social Networking', 'Advocacy Organizations', 'Political Organizations',
    'Arts and Culture', 'Folklore', 'Restaurant and Dining', 'Entertainment',
    'Personal Websites and Blogs'
  ],
  'General Interest - Business': [
    'Business', 'Charitable Organizations', 'Finance and Banking',
    'Information Technology', 'Web Hosting', 'Artificial Intelligence Technology'
  ],
  'General Interest - Personal': [
    'Education', 'Child Education', 'Health and Wellness', 'Medicine',
    'Job Search', 'Travel', 'Games', 'Auction', 'Shopping'
  ],
  'Potentially Liable / Illegal': [
    'Child Sexual Abuse', 'Drug Abuse', 'Hacking', 'Terrorism', 'Plagiarism',
    'Discrimination', 'Explicit Violence'
  ]
}

/** Why a category is usually filtered — shown as the field's hint. */
export const CATEGORY_NOTES = {
  'Executables':      'The category most worth blocking on an untrusted device, and the one most likely to break a legitimate workflow.',
  'Media Files':      'Usually blocked for bandwidth rather than risk.',
  'Documents':        'Note what is absent: no .doc, no .rtf, and no macro-enabled .docm or .xlsm, which carry most of the real risk. Use Custom for those.',
  'Compressed Files': 'An archive hides what is inside it from anything inspecting by extension.',
  'Scripts':          'Rarely needed by anyone outside engineering. .bat and .ps1 are not here — production files .bat under Executables.',
  'Images':           'Low risk. Usually filtered for storage rather than security. .svg is the exception: it can carry script.',
  'Custom':           'Type your own, one per line, with the dot.'
}
