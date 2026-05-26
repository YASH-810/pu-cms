import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4',
    'h5', 'h6', 'hgroup', 'main', 'nav', 'section', 'blockquote', 'dd', 'div',
    'dl', 'dt', 'figcaption', 'figure', 'hr', 'li', 'main', 'ol', 'p', 'pre',
    'ul', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn',
    'em', 'i', 'kbd', 'mark', 'q', 'rb', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp',
    'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'caption',
    'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
    'img', 'video', 'audio', 'source'
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
    video: ['src', 'controls', 'poster', 'width', 'height', 'muted', 'loop', 'autoplay'],
    audio: ['src', 'controls', 'muted', 'loop', 'autoplay'],
    source: ['src', 'type'],
    '*': ['class', 'id', 'style', 'dir', 'lang']
  },
  selfClosing: ['img', 'br', 'hr', 'area', 'base', 'col', 'embed', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'],
  allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: true,
  enforceHtmlBoundary: false
};

/**
 * Sanitizes unsafe HTML string input to prevent XSS (Cross-Site Scripting).
 * @param dirty The unsafe html content.
 * @returns Safe HTML content.
 */
export function sanitizeInputHtml(dirty: string | null | undefined): string {
  if (dirty === null || dirty === undefined) {
    return '';
  }
  return sanitizeHtml(dirty, SANITIZE_OPTIONS);
}

/**
 * Recursively scans and sanitizes all string values in an object.
 */
export function sanitizeObjectStrings<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeInputHtml(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectStrings(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && (key === 'body' || key === 'content' || key === 'description' || key === 'remarks')) {
        result[key] = sanitizeInputHtml(val);
      } else {
        result[key] = sanitizeObjectStrings(val);
      }
    }
    return result as unknown as T;
  }

  return obj;
}
