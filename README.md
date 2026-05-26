# ytdl-local

本地 YouTube 单视频下载 CLI。用 Node.js 包装 `yt-dlp` 和 `ffmpeg`，负责参数校验、字幕策略、音视频合并和输出目录管理。

> 个人学习项目。请只下载你拥有版权、已获授权，或平台明确允许下载的内容。

## 功能

✅ 下载单个 YouTube 视频

✅ 支持 `--cookies-from-browser` 读取浏览器登录态

✅ 默认 `auto` 智能画质策略，优先高分辨率 VP9 / 非 AV1 来源

✅ 支持 `stable` / `sharp` 手动画质策略

✅ 自动合并视频流和音频流为 `.mkv`

✅ 自动下载人工字幕；没有人工字幕时下载自动字幕

✅ 遇到缺失媒体分片时直接失败，避免生成损坏文件

✅ 自动创建输出目录

## 依赖

- Node.js 18+
- [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)
- `ffmpeg`

```bash
brew install yt-dlp ffmpeg
```

## 使用

直接运行：

```bash
node ./bin/ytdl-local.js "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome
```

如果已执行 `npm link`：

```bash
ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome
```

`--cookies-from-browser` 通常用于需要登录才能观看的内容；请选择已经登录 YouTube 的浏览器。

> zsh 里建议给 YouTube 链接加引号，避免 `?` 被 shell 解释。

## 画质策略

默认不用传 `--quality`，等价于 `--quality auto`。

| 策略 | 用途 |
| --- | --- |
| `auto` | 默认推荐。优先 4K / 高分辨率 VP9 或非 AV1，找不到再回落到任意分辨率 |
| `stable` | 不强求高分辨率，挑 VP9 优先的稳定组合，避开 AV1 |
| `sharp` | 与 `auto` 类似，但允许 1080p 及以下的高码率 HLS 合流，文件可能更大 |

示例：

```bash
ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome --quality sharp
```

## 输出

下载结果会保存到输出目录：

```text
downloads/
  视频标题 [VIDEO_ID].mkv
  视频标题 [VIDEO_ID].<lang>.srt
```

`.mkv` 内已包含视频和音频；字幕会保存视频提供的所有语言，不含直播聊天字幕。

## 注意

- 不要上传下载的视频、字幕、cookies 或登录态数据到 GitHub。
- iPhone 播放 `.mkv` 和外挂字幕建议使用 VLC for iOS。
- 本项目不用于绕过 DRM、付费访问、私密视频限制或其他访问控制。
