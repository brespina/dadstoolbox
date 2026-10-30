// A remade video's picture size, in plain maths: no library, so the page can use it too.

export interface PictureSize {
  width: number;
  height: number;
}

const upToEven = (n: number) => Math.ceil(n / 2) * 2;

/**
 * Fits a video's shown size (already turned the right way up) to a longest side, never
 * larger. `set` is the one side to give Mediabunny (the other follows the shape), and
 * `size` is the size it makes: like Mediabunny 1.61.4, each side rounded up to even.
 */
export function fitLongestSide(
  { width, height }: PictureSize,
  longestSide?: number,
): { set: Partial<PictureSize>; size: PictureSize } {
  if (!longestSide || Math.max(width, height) <= longestSide) {
    return { set: {}, size: { width, height } };
  }
  if (width >= height) {
    const across = upToEven(longestSide);
    return {
      set: { width: longestSide },
      size: { width: across, height: upToEven(Math.round(across / (width / height))) },
    };
  }
  const down = upToEven(longestSide);
  return {
    set: { height: longestSide },
    size: { width: upToEven(Math.round(down * (width / height))), height: down },
  };
}
