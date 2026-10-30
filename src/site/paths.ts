/** A path on the Site, such as sitePath('promise') → "/dadstoolbox/promise/". */
export function sitePath(path = ''): string {
  // BASE_URL may or may not end in a slash, so join and then collapse any double slash.
  return `${import.meta.env.BASE_URL}/${path}/`.replace(/\/+/g, '/');
}
