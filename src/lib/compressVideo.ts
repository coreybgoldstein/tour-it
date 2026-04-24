import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Singleton — reuse across the session so WASM only loads once
let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

// Mutex — only one compression job runs at a time
let compressionQueue: Promise<unknown> = Promise.resolve();

async function getFFmpeg(onStatus: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (!loadPromise) {
    const ff = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    loadPromise = (async () => {
      onStatus("Loading compressor (one-time)…");
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      await ff.load({ coreURL, wasmURL });
      ffmpegInstance = ff;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }

  await loadPromise;
  return ffmpegInstance!;
}

const SKIP_THRESHOLD_MB = 30;

export async function compressVideo(
  file: File,
  onProgress: (stage: string, pct: number) => void
): Promise<File> {
  if (file.size < SKIP_THRESHOLD_MB * 1024 * 1024) {
    onProgress("Done", 100);
    return file;
  }

  // Queue: wait for the current job before starting
  let releaseSlot!: () => void;
  const slot = new Promise<void>((r) => { releaseSlot = r; });
  const prev = compressionQueue;
  compressionQueue = compressionQueue.then(() => slot);

  // Signal "waiting" if another job is already running
  let waitSignaled = false;
  const waitTimer = setTimeout(() => {
    waitSignaled = true;
    onProgress("Waiting for previous compression…", 0);
  }, 300);

  await prev;
  clearTimeout(waitTimer);
  if (waitSignaled) onProgress("Starting…", 0);

  try {
    let ff: FFmpeg;
    try {
      ff = await getFFmpeg((msg) => onProgress(msg, 0));
    } catch {
      return file;
    }

    // Register a named listener so we can remove it when done
    const progressHandler = ({ progress }: { progress: number }) => {
      onProgress("Compressing", Math.min(99, Math.round(progress * 100)));
    };
    ff.on("progress", progressHandler);

    try {
      onProgress("Reading file…", 0);
      await ff.writeFile("input.mp4", await fetchFile(file));

      onProgress("Compressing", 0);
      await ff.exec([
        "-i", "input.mp4",
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:a", "96k",
        "-movflags", "+faststart",
        "output.mp4",
      ]);

      const data = await ff.readFile("output.mp4");
      await ff.deleteFile("input.mp4").catch(() => {});
      await ff.deleteFile("output.mp4").catch(() => {});

      const bytes = data as Uint8Array;
      const blob = new Blob([new Uint8Array(bytes).buffer], { type: "video/mp4" });
      const compressed = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, ".mp4"),
        { type: "video/mp4" }
      );

      onProgress("Done", 100);
      return compressed;
    } catch {
      // Compression failed — fall back to original
      try { await ff.deleteFile("input.mp4"); } catch {}
      try { await ff.deleteFile("output.mp4"); } catch {}
      return file;
    } finally {
      ff.off("progress", progressHandler);
    }
  } finally {
    releaseSlot();
  }
}
