# ytdl-local

Personal learning project: a minimal local Node.js CLI wrapper around `yt-dlp` and `ffmpeg` for experimenting with command-line tooling and media-processing workflows.

This project is not a hosted download service, not a content redistribution tool, and not intended to bypass platform restrictions. Use it only with content that you own, have permission to download, or that the platform explicitly allows you to download.

## Usage

```bash
ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome
```

You can also run it directly from this project:

```bash
node ./bin/ytdl-local.js "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome
```

Use sharper high-bitrate mode when the source video only has 1080p but YouTube offers a higher-bitrate stream:

```bash
ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome --quality sharp
```

Quote YouTube URLs in zsh because `?` can be interpreted by the shell.

## Requirements

- Node.js 18+
- `yt-dlp`
- `ffmpeg`

## Output

The CLI saves video and subtitle files into the output directory.

Default behavior:

- Downloads one YouTube video URL.
- Defaults to `--quality stable`, preferring VP9 to avoid AV1 playback issues on some players.
- Supports `--quality sharp`, which may download a larger high-bitrate stream when available.
- Merges video and audio into MKV.
- Remuxes the final result to MKV without re-encoding when needed.
- Downloads manual subtitles when available, otherwise automatic subtitles.
- Keeps subtitle files separate, such as `.zh.srt` or `.en.srt`.

## iPhone Playback

For iPhone, use VLC for iOS rather than the built-in player when using MKV and external subtitles.

Put the `.mkv` file and the matching `.srt` subtitle files in the same VLC folder. If subtitles are not loaded automatically, select the subtitle file manually from VLC during playback.

## GitHub Upload Safety

This public repository should contain only source code and documentation.

Do not upload:

- Downloaded videos.
- Downloaded subtitles.
- Browser cookies.
- Cookie export files.
- Login/session data.
- Large media files.

This repository includes `.gitignore` rules to exclude common downloaded media and subtitle files.

## Compliance

This is a personal learning project. It is provided for studying Node.js CLI development and local process orchestration with tools such as `yt-dlp` and `ffmpeg`.

Use this tool only for content that you own, are authorized to download, or that the platform explicitly permits you to download.

Do not use this project to bypass DRM, paid access, private video restrictions, or other access controls.

Do not use this project to infringe copyright, redistribute third-party videos, mirror protected content, or violate platform terms.
