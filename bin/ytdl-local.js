#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const YTDLP = "yt-dlp";
const FFMPEG = "ffmpeg";
const NODE_JS_RUNTIME = `node:${process.execPath}`;
const QUALITY_AUTO = "auto";
const QUALITY_STABLE = "stable";
const QUALITY_SHARP = "sharp";
const FORMAT_SELECTORS = {
  [QUALITY_AUTO]:
    "bv*[height>1080][vcodec^=vp9]+ba/bv*[height>1080][vcodec^=vp09]+ba/bv*[height>1080][vcodec!*=av01]+ba/bv*[vcodec^=vp9]+ba/bv*[vcodec^=vp09]+ba/bv*[vcodec!*=av01]+ba/b",
  [QUALITY_STABLE]: "bv*[vcodec^=vp9]+ba/bv*[vcodec^=vp09]+ba/bv*[vcodec!*=av01]+ba/b",
  [QUALITY_SHARP]:
    "bv*[height>1080][vcodec^=vp9]+ba/bv*[height>1080][vcodec^=vp09]+ba/bv*[height>1080][vcodec!*=av01]+ba/b[height<=1080][protocol*=m3u8]/b[height<=1080]/bv*[vcodec^=vp9]+ba/bv*[vcodec^=vp09]+ba/bv*[vcodec!*=av01]+ba/b",
};

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.url) {
    printHelp();
    throw new Error("Missing YouTube URL.");
  }

  validateYoutubeUrl(options.url);

  const outputDir = path.resolve(process.cwd(), options.out ?? "downloads");
  await mkdir(outputDir, { recursive: true });

  await checkDependency(YTDLP, ["--version"], "Install it with: brew install yt-dlp");
  await checkDependency(FFMPEG, ["-version"], "Repair or install it with: brew reinstall ffmpeg");

  console.log("Reading video metadata...");
  const metadata = await readMetadata(options.url, options);
  const hasManualSubtitles = hasUsableSubtitles(metadata.subtitles);
  const subtitleMode = hasManualSubtitles ? "manual subtitles" : "automatic subtitles";

  console.log(`Title: ${metadata.title ?? "Unknown title"}`);
  console.log(`Quality: ${options.quality}`);
  console.log(`Subtitle mode: ${subtitleMode}`);
  if (options.cookiesFromBrowser) {
    console.log(`Cookies: ${options.cookiesFromBrowser}`);
  }
  console.log(`Output: ${outputDir}`);
  console.log("Starting download...");

  const downloadArgs = buildDownloadArgs(options.url, outputDir, hasManualSubtitles, options);
  await runInherited(YTDLP, downloadArgs);

  console.log("Done.");
}

function parseArgs(args) {
  const parsed = {
    url: null,
    out: null,
    cookiesFromBrowser: null,
    quality: QUALITY_AUTO,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "-h" || arg === "--help") {
      parsed.help = true;
      continue;
    }

    if (arg === "--out") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --out.");
      }
      parsed.out = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      const value = arg.slice("--out=".length);
      if (!value) {
        throw new Error("Missing value for --out.");
      }
      parsed.out = value;
      continue;
    }

    if (arg === "--cookies-from-browser") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --cookies-from-browser.");
      }
      parsed.cookiesFromBrowser = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--cookies-from-browser=")) {
      const value = arg.slice("--cookies-from-browser=".length);
      if (!value) {
        throw new Error("Missing value for --cookies-from-browser.");
      }
      parsed.cookiesFromBrowser = value;
      continue;
    }

    if (arg === "--quality") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --quality.");
      }
      parsed.quality = parseQuality(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--quality=")) {
      const value = arg.slice("--quality=".length);
      if (!value) {
        throw new Error("Missing value for --quality.");
      }
      parsed.quality = parseQuality(value);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (parsed.url) {
      throw new Error("Only one YouTube URL is supported.");
    }

    parsed.url = arg;
  }

  return parsed;
}

function parseQuality(value) {
  if (value === QUALITY_AUTO || value === QUALITY_STABLE || value === QUALITY_SHARP) {
    return value;
  }

  throw new Error(`Invalid quality: ${value}. Use "auto", "stable", or "sharp".`);
}

function validateYoutubeUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const isYoutube =
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtu.be";

  if (!isYoutube) {
    throw new Error("Only YouTube URLs are supported.");
  }
}

async function checkDependency(command, args, hint) {
  try {
    await runCaptured(command, args);
  } catch (error) {
    throw new Error(`${command} is not available or failed to run. ${hint}\n${error.message}`);
  }
}

async function readMetadata(url, options) {
  const result = await runCaptured(YTDLP, [
    ...buildBaseYtDlpArgs(options),
    "-J",
    "--skip-download",
    "--no-playlist",
    url,
  ]);

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("yt-dlp returned invalid metadata JSON.");
  }
}

function hasUsableSubtitles(subtitles) {
  if (!subtitles || typeof subtitles !== "object") {
    return false;
  }

  return Object.entries(subtitles).some(([language, tracks]) => {
    return language !== "live_chat" && Array.isArray(tracks) && tracks.length > 0;
  });
}

function buildDownloadArgs(url, outputDir, hasManualSubtitles, options) {
  const args = [
    ...buildBaseYtDlpArgs(options),
    "--no-playlist",
    "--abort-on-unavailable-fragments",
    "-f",
    FORMAT_SELECTORS[options.quality],
    "--merge-output-format",
    "mkv",
    "--remux-video",
    "mkv",
    "--sub-format",
    "srt/vtt/best",
    "--sub-langs",
    "all,-live_chat",
    "-o",
    path.join(outputDir, "%(title).200B [%(id)s].%(ext)s"),
  ];

  if (hasManualSubtitles) {
    args.push("--write-subs");
  } else {
    args.push("--write-auto-subs");
  }

  args.push(url);
  return args;
}

function buildBaseYtDlpArgs(options) {
  const args = ["--js-runtimes", NODE_JS_RUNTIME, "--remote-components", "ejs:github"];

  if (options.cookiesFromBrowser) {
    args.push("--cookies-from-browser", options.cookiesFromBrowser);
  }

  return args;
}

function runCaptured(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const output = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
      reject(new Error(output || `${command} exited with code ${code}.`));
    });
  });
}

function runInherited(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

function printHelp() {
  console.log(`Usage:
  ytdl-local "YOUTUBE_URL" [--out ./downloads] [--cookies-from-browser chrome] [--quality auto|stable|sharp]

Examples:
  ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID"
  ytdl-local "https://youtu.be/VIDEO_ID" --out ~/Downloads
  ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --cookies-from-browser chrome
  ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --quality sharp --cookies-from-browser chrome`);
}
