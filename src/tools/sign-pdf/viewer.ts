// Sign a PDF's page viewer: pdf.js, which only shows pages (ADR-0006). The page editor
// loads this module with a dynamic import(), behind "Getting ready…": the shared Tool
// page imports every FileOptions.svelte eagerly, so a static import would put pdf.js on
// every Tool's page. Nothing else imports it.
//
// The legacy build, because the modern one calls the newest JavaScript (such as
// Map.prototype.getOrInsertComputed and Math.sumPrecise) that iPhone Safari lacks.

import {
  AnnotationMode,
  getDocument,
  GlobalWorkerOptions,
  RenderingCancelledException,
  version,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { sitePath } from '../../site/paths';
import { openToSign } from './can-sign';

// pdf.js's own worker file, served from the Site.
GlobalWorkerOptions.workerSrc = workerUrl;
// The data files pdf.js asks for by name (src/site/pdfjs-files.ts).
const files = sitePath(`pdfjs/${version}`);

/** Pages are drawn at most this many pixels per CSS pixel, to spare a phone's memory. */
const maxPixelRatio = 2;

/** One page of the PDF, as it is shown (after its own turn, within its visible box). */
export interface ShownPage {
  /** Its shown size, in PDF points. */
  width: number;
  height: number;
  /**
   * Draws the page on `canvas`, `cssWidth` CSS pixels wide. `cancel` stops a drawing
   * still under way and frees the canvas.
   */
  draw(canvas: HTMLCanvasElement, cssWidth: number): { done: Promise<void>; cancel(): void };
}

export interface ShownPdf {
  pages: ShownPage[];
  /** Frees pdf.js's copy of the PDF. */
  close(): void;
}

function shownPage(page: PDFPageProxy): ShownPage {
  const { width, height } = page.getViewport({ scale: 1 });
  return {
    width,
    height,
    draw(canvas, cssWidth) {
      const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
      const viewport = page.getViewport({ scale: cssWidth / width });
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      const task = page.render({
        canvas,
        viewport,
        // Form fields are drawn with what is typed in them.
        annotationMode: AnnotationMode.ENABLE_STORAGE,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      const done = task.promise.then(
        () => void page.cleanup(),
        (error: unknown) => {
          if (!(error instanceof RenderingCancelledException)) throw error;
        },
      );
      return {
        done,
        cancel() {
          task.cancel();
          canvas.width = canvas.height = 0;
        },
      };
    },
  };
}

/**
 * Opens a chosen PDF to show its pages. Runs the shared "can this PDF be signed" check
 * first, so it throws that check's ToolFailure (or an ordinary error for a damaged file)
 * before pdf.js ever sees the file.
 */
export async function showPdf(file: File): Promise<ShownPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  await openToSign(bytes);
  const task = getDocument({
    // pdf.js takes these bytes away to its worker; `run` reads the file afresh.
    data: bytes,
    // No WebAssembly (ADR-0006): pdf.js uses its plain-script decoders instead.
    useWasm: false,
    wasmUrl: `${files}wasm/`,
    cMapUrl: `${files}cmaps/`,
    cMapPacked: true,
  });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (error) {
    void task.destroy();
    throw error;
  }
  const pages: ShownPage[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    pages.push(shownPage(await doc.getPage(number)));
  }
  // Destroying the loading task stops its worker and frees the PDF.
  return { pages, close: () => void task.destroy() };
}
