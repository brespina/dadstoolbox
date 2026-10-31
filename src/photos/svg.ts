// Sizing an SVG picture for drawing. An SVG has no pixels of its own, and browsers
// disagree about the size of one that doesn't state its size, so the size is worked out
// here and written onto the picture before the browser draws it.

/** The width an SVG is drawn at when it doesn't state its size. */
export const unstatedSvgWidth = 1024;
/** What browsers use for a picture with no size and no shape: 300 × 150. */
const defaultShape = { width: 300, height: 150 };

/** Pixels in each absolute unit CSS knows. */
const pixelsPer: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
};

/** A length such as "40", "12.5px" or "2in" as pixels, or undefined for any other (%, em, auto...). */
function lengthInPixels(value: string | undefined): number | undefined {
  const match = /^\s*(\d*\.?\d+(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value ?? '');
  const unit = pixelsPer[match?.[2]?.toLowerCase() ?? '?'];
  const pixels = match && unit !== undefined ? Number(match[1]) * unit : 0;
  return pixels > 0 && Number.isFinite(pixels) ? pixels : undefined;
}

/** The shape from a viewBox such as "0 0 40 30", if it has one. */
function viewBoxShape(value: string | undefined) {
  const parts = (value ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width, height] = parts;
  return parts.length === 4 && width! > 0 && height! > 0
    ? { width: width!, height: height! }
    : undefined;
}

// The start tag of the root element. Quoted values may hold ">".
const rootTag = /<svg(?=[\s/>])((?:[^>"']|"[^"]*"|'[^']*')*)>/;
const attribute = /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export interface SizedSvg {
  /** The SVG text with its width and height set to the size it is drawn at. */
  markup: string;
  /** Whole pixels. */
  width: number;
  height: number;
}

/**
 * Works out the size to draw an SVG at: its stated width and height if both are lengths
 * in absolute units; otherwise 1024 wide in the shape of its viewBox (or, with none, of
 * the 300 × 150 browsers use). Throws an Error if the text is not an SVG.
 */
export function sizeSvg(text: string): SizedSvg {
  // Comments may hold anything, so look for the root element with them blanked out.
  const visible = text.replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length));
  const found = rootTag.exec(visible);
  if (!found) throw new Error('Not an SVG picture');
  const start = found.index;
  const selfClosing = found[1]!.endsWith('/');
  const attributes = [...found[1]!.matchAll(attribute)].map((m) => ({
    name: m[1]!,
    value: m[2] ?? m[3]!,
  }));
  const valueOf = (name: string) => attributes.find((a) => a.name === name)?.value;

  const statedWidth = lengthInPixels(valueOf('width'));
  const statedHeight = lengthInPixels(valueOf('height'));
  const shape = viewBoxShape(valueOf('viewBox'));
  const [width, height] =
    statedWidth && statedHeight
      ? [statedWidth, statedHeight]
      : [
          unstatedSvgWidth,
          (unstatedSvgWidth * (shape ?? defaultShape).height) / (shape ?? defaultShape).width,
        ];
  const whole = [Math.max(1, Math.round(width)), Math.max(1, Math.round(height))] as const;

  // A viewBox that gives no shape is replaced, so the picture is scaled, not cropped.
  const kept = attributes.filter(
    (a) => a.name !== 'width' && a.name !== 'height' && (shape || a.name !== 'viewBox'),
  );
  const written = [
    ...kept.map((a) => `${a.name}="${a.value.replaceAll('"', '&quot;')}"`),
    `width="${whole[0]}"`,
    `height="${whole[1]}"`,
    ...(shape ? [] : [`viewBox="0 0 ${defaultShape.width} ${defaultShape.height}"`]),
  ];
  const tag = `<svg ${written.join(' ')}${selfClosing ? '/' : ''}>`;
  return {
    markup: text.slice(0, start) + tag + text.slice(start + found[0].length),
    width: whole[0],
    height: whole[1],
  };
}
