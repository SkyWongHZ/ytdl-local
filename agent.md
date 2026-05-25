# ytdl-local Agent Notes

## Project Goal

This project is a minimal local Node.js CLI for downloading one YouTube video at a time.

It is a personal learning project for studying Node.js CLI development and local orchestration of `yt-dlp` and `ffmpeg`. Public repository text must make clear that it is not a hosted download service, not a redistribution tool, and not intended for copyright infringement or platform restriction bypass.

Keep the scope small:

- No web UI.
- No Koa, Nest, Fastify, Hono, or other HTTP frameworks.
- No database, queue, download manager, or history system.
- No custom YouTube extractor implementation in Node.js.
- Node.js should only handle CLI args, local checks, and spawning `yt-dlp`.

## Runtime Dependencies

The CLI depends on local executables:

- `node` >= 18
- `yt-dlp`
- `ffmpeg`

The current machine was fixed with:

- `yt-dlp` installed in an isolated Python venv at `~/.local/share/ytdl-local/yt-dlp-venv`
- `/usr/local/bin/yt-dlp` symlinked to that venv executable
- `ffmpeg` reinstalled through Homebrew and verified at version `8.1.1`

Do not vendor `yt-dlp` or `ffmpeg` into this repo.

## Usage

From the project directory:

```bash
ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome
```

Equivalent direct Node command:

```bash
node ./bin/ytdl-local.js "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome
```

Use `--quality sharp` when the user wants the highest practical bitrate from the source:

```bash
ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome --quality sharp
```

Quote YouTube URLs in zsh because `?` can be interpreted by the shell.

## CLI Behavior

The CLI currently supports:

- One positional YouTube URL.
- Optional `--out <dir>`, defaulting to `./downloads`.
- Optional `--cookies-from-browser <browser>`, such as `chrome`, `safari`, `firefox`, or `edge`.
- Optional `--quality stable|sharp`, defaulting to `stable`.

Before downloading, it checks:

- `yt-dlp --version`
- `ffmpeg -version`

It reads metadata first with:

```bash
yt-dlp -J --skip-download --no-playlist
```

Then it downloads with `yt-dlp` and lets `yt-dlp` print progress directly to the terminal.

## Important yt-dlp Choices

Base args include:

```bash
--js-runtimes node:<current-node-path>
--remote-components ejs:github
```

These are required for current YouTube extraction behavior. Without them, YouTube may fail with JavaScript runtime or `n challenge` errors.

The default `stable` format selector intentionally avoids AV1 first:

```bash
bv*[vcodec^=vp9]+ba/bv*[vcodec^=vp09]+ba/bv*[vcodec!*=av01]+ba/b
```

Reason: the original highest-quality download selected 4K AV1. Some macOS players showed a white screen with audio only. VP9 4K is preferred because it is more likely to play correctly while still keeping high resolution.

The optional `sharp` selector prioritizes higher-bitrate streams when the source only has 1080p:

```bash
bv*[height>1080][vcodec^=vp9]+ba/bv*[height>1080][vcodec^=vp09]+ba/bv*[height>1080][vcodec!*=av01]+ba/b[height<=1080][protocol*=m3u8]/b[height<=1080]/bv*[vcodec^=vp9]+ba/bv*[vcodec^=vp09]+ba/bv*[vcodec!*=av01]+ba/b
```

This can produce much larger files. It should not be described as upscaling; it only selects a better source stream when YouTube offers one.

The output container is still MKV:

```bash
--merge-output-format mkv
--remux-video mkv
```

MKV was not the white-screen cause; the AV1 video codec was. `--remux-video mkv` keeps the final extension stable when `sharp` selects an already combined HLS stream.

## Subtitle Behavior

The CLI checks metadata first:

- If manual subtitles exist, use `--write-subs`.
- If no manual subtitles exist, use `--write-auto-subs`.
- Always exclude live chat with `--sub-langs all,-live_chat`.
- Prefer `srt`, then `vtt`, then best available with `--sub-format srt/vtt/best`.

## Known Operational Notes

Some YouTube videos require browser cookies:

```bash
--cookies-from-browser chrome
```

Use the browser where the user is already signed into YouTube.

If video plays with audio only, inspect the file:

```bash
ffprobe -hide_banner -show_streams -select_streams v:0 "<file>.mkv"
```

If the codec is `av1`, prefer re-downloading with the current VP9-first selector instead of changing the container.

## Verification Commands

Use these checks after edits:

```bash
node --check bin/ytdl-local.js
ytdl-local --help
yt-dlp --version
ffmpeg -version
```

For a real smoke test, use:

```bash
ytdl-local "https://www.youtube.com/watch?v=ggGc-u0lLYs" --out ./downloads-vp9 --cookies-from-browser chrome
```

For high-bitrate mode:

```bash
ytdl-local "https://www.youtube.com/watch?v=lHJDH_LrIlc" --out ./downloads --cookies-from-browser chrome --quality sharp
```

Avoid downloading large files unless the user explicitly wants a real download test.

## Editing Guidelines

- Keep implementation in `bin/ytdl-local.js` unless there is a concrete need to split files.
- Use only Node.js built-in modules unless the user explicitly asks for more features.
- Keep error messages direct and actionable.
- Do not add batch downloads, playlists, a UI, or MP4 transcoding unless requested.
- Do not rewrite unrelated downloaded files under `downloads/` or `downloads-vp9/`.
- When publishing to GitHub, upload only source code and documentation; do not upload downloaded media, subtitles, cookies, or login/session data.
