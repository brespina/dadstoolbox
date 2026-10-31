# Video sound is copied, or remade by the browser

The shared video module (`src/video/remake.ts`) saves MP4s with AAC sound. Sound already in AAC is copied as is. Other sound (such as Opus from Android phones) is remade to AAC with the browser's own encoder. We chose this over shipping an FFmpeg-based AAC encoder, which would work in every browser but adds a large download to every video Tool and a licence to track.

## Consequences

- On a browser that can't remake the sound, the Tool fails with a plain reason (`cantKeepSound`). It never saves a silent video.
- A browser may claim it can read the sound and then give none back (WebKit on Linux with Opus). The module waits a short while for the first sound and fails with the same reason, so the row never hangs on Working….
- Which phones can remake Opus is checked on real phones (#52).
