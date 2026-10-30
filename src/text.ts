/** Fills a text's {placeholders}, as in fillText('Remove {name}', { name: 'a.pdf' }). */
export function fillText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key]));
}

// All shared text a visitor reads. The banned-words test scans everything here,
// so keep addresses and other non-reading values out (see links.ts).

export const text = {
  siteName: "Dad's Toolbox",
  // Used in the footer and on the Our promise page.
  reportProblem: 'Report a problem',
  home: {
    title: "Dad's Toolbox: free tools for your files",
    // Shown under the Site name, and used as the page description for search engines.
    promiseLine:
      'Free tools for your files. No sign-up, no ads, and your files stay on your device.',
  },
  // Category headings on the home page, in their fixed order.
  categories: {
    Photos: 'Photos',
    PDFs: 'PDFs',
    Video: 'Video',
    Other: 'Other',
  },
  promisePage: {
    title: "Our promise: Dad's Toolbox",
    heading: 'Our promise',
    // The page description for search engines.
    description: "What Dad's Toolbox promises you, and how to check it yourself.",
    promise: {
      heading: 'The promise',
      points: [
        'No sign-up. We never ask for your name or email.',
        'No ads.',
        'Nothing counts or tracks you.',
        'Your files stay on your device. We never keep them or send them anywhere.',
      ],
    },
    howItWorks: {
      heading: 'How it works',
      body: 'Your phone or computer does all the work.',
    },
    check: {
      heading: 'Check for yourself',
      airplaneModeCaveat:
        'Some Tools fetch a helper part from this Site the first time you use them. Use the Tool once with internet on, then turn on airplane mode and try again. It still works.',
      browserLock:
        'Each page tells your browser it may only talk to this Site. Your browser blocks anything else.',
    },
    freeAndOpen: {
      heading: 'Free and open',
      sourceCode: 'See the code on GitHub',
      host: "The Site is hosted by GitHub. Like any website host, GitHub may keep basic visit records for security. We can't see them and don't use them.",
      hostLink: "Read GitHub's privacy statement",
    },
  },
  tool: {
    // The browser tab title. {name} is the Tool's name, {siteName} the Site's.
    pageTitle: '{name}: {siteName}',
    backLink: 'All tools',
    // {noun} is the Tool's noun, such as "PDFs".
    privacyLine: 'Your {noun} stay on your device. They are never sent anywhere.',
    allDone: 'All done.',
    choose: 'Choose {noun}',
    remove: 'Remove',
    // {name} is the file name; for screen readers.
    removeLabel: 'Remove {name}',
    waitingHeading: 'Ready to start',
    save: 'Save',
    saveLabel: 'Save {name}',
    saveAll: 'Save all',
    // {current} and {total} count files in the Batch.
    progress: 'Working on {current} of {total}…',
    // Shown instead of the moving progress bar when reduced motion is on.
    working: 'Working…',
    status: {
      ready: 'Ready',
      working: 'Working…',
      done: 'Done',
      failed: "Didn't work",
    },
    // {name} is the file name and {status} its new status.
    announcement: '{name}: {status}',
    // A row that didn't work. {reason} is the Tool's own reason, or failedFallback.
    failedLine: "Didn't work. {reason}",
    // The reason shown when the Tool gave none of its own.
    failedFallback: 'This file may be damaged or not supported.',
    // Tools the person types into instead of choosing files (input mode "none").
    typed: {
      // The label on the box, unless the Tool gives its own.
      label: 'Type here',
      // Read out when a new result is ready to save.
      ready: 'Ready to save.',
      // The reason shown when the Tool gave none of its own.
      failedFallback: "That didn't work. Try changing what you typed.",
      // The alt text on the result picture. {noun} is the Tool's noun, {typed} what was typed.
      pictureLabel: '{noun} that says: {typed}',
    },
  },
  footer: {
    label: 'More about the Site',
    promise: 'Our promise',
    sponsor: 'Sponsor',
  },
} as const;
