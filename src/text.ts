// All shared text a visitor reads. The banned-words test scans everything here,
// so keep addresses and other non-reading values out (see links.ts).

export const text = {
  siteName: "Dad's Toolbox",
  home: {
    title: "Dad's Toolbox: free tools for your files",
    description:
      'Free tools for your files. No sign-up, no ads, and your files stay on your device.',
    promiseLine:
      'Free tools for your files. No sign-up, no ads, and your files stay on your device.',
    noToolsYet: 'Tools are coming soon.',
  },
  footer: {
    label: 'More about the Site',
    promise: 'Our promise',
    reportProblem: 'Report a problem',
    sponsor: 'Sponsor',
  },
} as const;
