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
      credits: 'Free code we use',
    },
  },
  creditsPage: {
    title: "Free code we use: Dad's Toolbox",
    heading: 'Free code we use',
    description: "The free code Dad's Toolbox is built on, with each license.",
    intro:
      'The Tools are built on free code that other people wrote and share. Thank you to them. Here is each one, what it does, and its license.',
    unchanged:
      'We use each one as it comes, unchanged. Each link below leads to its code and its full license.',
    // {name} is the library that brings this one in.
    partOf: 'Part of {name}.',
    // {license} is a license name, such as "MIT".
    version: 'Version {version}.',
    license: 'License: {license}',
    // {name} is a library's name. The link text must stay unique on the page.
    codeLink: '{name} code',
    licenseLink: '{name} license',
  },
  tool: {
    // The browser tab title. {name} is the Tool's name, {siteName} the Site's.
    pageTitle: '{name}: {siteName}',
    backLink: 'All tools',
    // {noun} is the Tool's noun, such as "PDFs".
    privacyLine: 'Your {noun} stay on your device. They are never sent anywhere.',
    allDone: 'All done.',
    choose: 'Choose {noun}',
    // Shown once some files are chosen.
    chooseMore: 'Choose more {noun}',
    // A Batch's label: {options} is the Tool's words for its options, {count} as in "3 photos".
    batchLabel: '{options} · {count}',
    remove: 'Remove',
    // {name} is the file name; for screen readers.
    removeLabel: 'Remove {name}',
    // Set the order of files that are used together. {name} labels them for screen readers.
    moveUp: '↑',
    moveUpLabel: 'Move {name} up',
    moveDown: '↓',
    moveDownLabel: 'Move {name} down',
    waitingHeading: 'Ready to start',
    // On the Ready row of a file over the Tool's size limit. {noun} is the Tool's noun,
    // such as "photo". A Tool may give its own.
    largeFileNote: 'This {noun} is big for a phone. It may take a few minutes or stop partway.',
    // Where the browser lacks a feature the Tool needs: on its home page row and its page.
    unsupported: "Doesn't work on this browser yet",
    save: 'Save',
    saveLabel: 'Save {name}',
    saveAll: 'Save all',
    // {current} and {total} count files in the Batch.
    progress: 'Working on {current} of {total}…',
    // Shown instead of the moving progress bar when reduced motion is on.
    working: 'Working…',
    // Shown while something big the Tool needs is still loading.
    gettingReady: 'Getting ready…',
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
  // Shared by the photo Tools.
  photos: {
    removeLocation: 'Remove location',
    removeLocationHint: 'So no one can tell where a photo was taken.',
    allDoneLocationRemoved: 'All done. Location data removed.',
    // Neither the browser nor the late-loaded decoder could open an iPhone photo.
    heicWontOpen: "This iPhone photo (HEIC) wouldn't open. Choose it again, or try another photo.",
    // A Batch label when location was kept. {format} is the format's name.
    locationKeptLabel: '{format}, location kept',
    saveAs: 'Save as',
    // {format} is the chosen format's name.
    startButton: 'Change to {format}',
    formats: {
      jpg: { name: 'JPG', hint: 'Opens and sends anywhere.' },
      png: { name: 'PNG', hint: 'Sharpest, but a bigger file.' },
      webp: { name: 'WebP', hint: "Small file. Some apps can't open it." },
    },
    // Make a photo smaller: how small to make it.
    howSmall: 'How small',
    // A Batch label when location was kept. {size} is the chosen size's name.
    sizeLocationKeptLabel: '{size}, location kept',
    sizes: {
      medium: { name: 'Medium', hint: 'Sharp on a big screen. Good for email.' },
      small: { name: 'Small', hint: 'Fine on a phone. For sites with a size limit.' },
      tiny: { name: 'Tiny', hint: 'Smallest file. Looks soft up close.' },
    },
  },
  footer: {
    label: 'More about the Site',
    promise: 'Our promise',
    sponsor: 'Sponsor',
  },
} as const;
