# Tools run in the visitor's browser, not on a server

Dad's Toolbox is a hosted Site for non-technical people, and every Tool on it runs entirely in the visitor's browser (WebAssembly ffmpeg for media, plain JavaScript for the rest). We chose this over uploading files to a server, because it keeps the project's promises: files never leave the visitor's device, there are no terms to accept, and static hosting stays free however many people use it. A server would have meant paying for compute, holding strangers' files, and policing upload size and abuse.

## Consequences

- The Python command-line tools in OpenGarage (the author's separate learning repo) do not carry over; Tools here are written for the browser.
- A Tool that cannot run in a browser does not go on the Site (see ADR-0002).

## Note (2026-10)

The decision stands, but the aside about media is out of date. v1 has no ffmpeg (spec #15): Make a gif from a video reads the video with Mediabunny (the browser's own WebCodecs) and builds the gif with gifenc. ffmpeg.wasm, and its license question (#11), come back only if a later Tool needs it.
