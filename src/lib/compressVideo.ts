import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Singleton — reuse across the session so WASM only loads once
let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

async function getFFmpeg(onStatus: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (!loadPromise) {
    const ff = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    loadPromise = (async () => {
      onStatus("Loading compressor (one-time download)…");
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      await ff.load({ coreURL, wasmURL });
      ffmpegInstance = ff;
    })().catch((err) => {
      loadPromise = null; // allow retry
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
  // Skip compression for small files — faster to just upload directly
  if (file.size < SKIP_THRESHOLD_MB * 1024 * 1024) {
    onProgress("Done", 100);
    return file;
  }

  let ff: FFmpeg;
  try {
    ff = await getFFmpeg((msg) => onProgress(msg, 0));
  } catch {
    // Can't load ffmpeg — upload the original
    return file;
  }

  ff.on("progress", ({ progress }) => {
    onProgress("Compressing", Math.min(99, Math.round(progress * 100)));
  });

  onProgress("Reading file", 0);
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
  await ff.deleteFile("input.mp4");
  await ff.deleteFile("output.mp4");

  const bytes = data as Uint8Array;
  const copy = new Uint8Array(bytes).buffer as ArrayBuffer;
  const blob = new Blob([copy], { type: "video/mp4" });
  const compressed = new File(
    [blob],
    file.name.replace(/\.[^.]+$/, ".mp4"),
    { type: "video/mp4" }
  );

  onProgress("Done", 100);
  return compressed;
}
