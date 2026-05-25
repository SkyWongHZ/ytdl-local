# ytdl-local 需求文档

## 1. 背景

用户需要一个本地工具，用 Node.js 技术栈下载 YouTube 上的单个视频，并尽量保留最高画质和字幕。

本项目不直接用 Node.js 实现 YouTube 解析和媒体下载逻辑，而是通过 Node.js CLI 调用本机 `yt-dlp` 和 `ffmpeg` 完成下载、合并与字幕处理。

## 2. 产品目标

实现一个最小可用的本地命令行工具：

- 输入一个 YouTube 视频链接。
- 下载该视频的高画质版本。
- 合并视频和音频为本地文件。
- 下载字幕文件。
- 能处理 YouTube 当前常见的 JS challenge 和登录校验场景。

## 3. 用户场景

用户在终端中执行命令：

```bash
ytdl-local "https://www.youtube.com/watch?v=VIDEO_ID" --out ./downloads --cookies-from-browser chrome
```

工具读取视频元数据，判断字幕类型，调用 `yt-dlp` 下载视频、音频和字幕，并将结果保存到指定目录。

## 4. 功能需求

### 4.1 命令行入口

工具提供全局命令：

```bash
ytdl-local
```

支持以下参数：

- `YOUTUBE_URL`：必填，单个 YouTube 视频链接。
- `--out <dir>`：可选，输出目录；不传时默认使用 `./downloads`。
- `--cookies-from-browser <browser>`：可选，从浏览器读取登录态 cookies，支持 `chrome`、`safari`、`firefox`、`edge` 等 `yt-dlp` 支持的浏览器。
- `--quality <stable|sharp>`：可选，画质策略；默认 `stable`。
- `--help` / `-h`：输出使用说明。

### 4.2 输入校验

工具必须：

- 校验 URL 是否合法。
- 只接受 YouTube 域名链接，包括 `youtube.com`、子域名和 `youtu.be`。
- 只允许传入一个视频 URL。
- 遇到未知参数时给出明确错误。

### 4.3 依赖检查

下载前必须检查本机依赖：

- `yt-dlp --version`
- `ffmpeg -version`

任一依赖不可用时，工具应退出并给出可操作的安装或修复提示。

### 4.4 元数据读取

正式下载前，工具必须调用 `yt-dlp` 读取视频元数据：

```bash
yt-dlp -J --skip-download --no-playlist
```

读取元数据用于：

- 获取视频标题。
- 判断是否存在人工字幕。
- 决定字幕下载策略。

### 4.5 字幕策略

工具必须：

- 如果视频存在人工字幕，使用 `--write-subs`。
- 如果视频不存在人工字幕，使用 `--write-auto-subs`。
- 排除直播聊天字幕：`--sub-langs all,-live_chat`。
- 字幕格式优先级为：`srt/vtt/best`。

### 4.6 视频格式策略

工具必须优先下载更易播放的高画质格式，并允许用户选择更高码率策略。

默认 `stable` 策略格式选择器为：

```bash
bv*[vcodec^=vp9]+ba/bv*[vcodec^=vp09]+ba/bv*[vcodec!*=av01]+ba/b
```

该策略含义：

- 优先下载 VP9 视频流和最佳音频流。
- 如果没有 VP9，则选择非 AV1 的最佳视频流和最佳音频流。
- 最后兜底使用 `yt-dlp` 可用的最佳格式。

可选 `sharp` 策略格式选择器为：

```bash
bv*[height>1080][vcodec^=vp9]+ba/bv*[height>1080][vcodec^=vp09]+ba/bv*[height>1080][vcodec!*=av01]+ba/b[height<=1080][protocol*=m3u8]/b[height<=1080]/bv*[vcodec^=vp9]+ba/bv*[vcodec^=vp09]+ba/bv*[vcodec!*=av01]+ba/b
```

该策略含义：

- 1080p 以上仍优先 VP9 或非 AV1 的高分辨率分离流。
- 1080p 及以下优先 YouTube 的 HLS 高码率合并流。
- 文件可能明显变大，但画面可能更干净。

选择该策略的原因：

- YouTube 4K 默认可能返回 AV1。
- 部分 macOS 播放器对 4K AV1 支持不好，会出现有声音但画面白屏。
- VP9 4K 在画质和播放兼容性之间更适合当前需求。

### 4.7 YouTube JS Challenge 支持

工具调用 `yt-dlp` 时必须传入：

```bash
--js-runtimes node:<current-node-path>
--remote-components ejs:github
```

目的：

- 使用当前 Node.js 作为 JavaScript runtime。
- 允许 `yt-dlp` 拉取 EJS challenge solver。
- 避免 YouTube `n challenge` 导致只获取到图片或缺失视频格式。

### 4.8 输出文件

工具必须：

- 自动创建输出目录。
- 使用 `yt-dlp` 输出模板：

```bash
%(title).200B [%(id)s].%(ext)s
```

- 合并输出容器为 MKV：

```bash
--merge-output-format mkv
```

输出结果通常包括：

- 一个 `.mkv` 视频文件。
- 一个或多个字幕文件，例如 `.zh.srt`、`.en.srt`。

当选择到 HLS 合并流时，工具使用 `--remux-video mkv` 将最终结果无重编码封装为 MKV。

## 5. 非功能需求

- 实现应保持最小化。
- 不引入第三方 npm 依赖。
- 不使用 Koa、Nest、Fastify、Hono 等 Node Web 框架。
- 下载进度直接透传 `yt-dlp` 的终端输出。
- 长视频下载由 `yt-dlp` 处理，Node.js 不接管媒体流。
- 错误信息应直接、可理解、可操作。

## 6. 明确不做

第一版不支持：

- Web UI。
- 桌面 App。
- 播放列表下载。
- 批量下载。
- 下载队列。
- 数据库。
- 下载历史。
- 自动转码 MP4。
- 自研 YouTube 解析器。
- 绕过 DRM、付费墙、私密视频或会员视频限制。

## 7. 验收标准

### 7.1 基础命令

执行：

```bash
ytdl-local --help
```

应输出命令使用说明。

### 7.2 依赖检查

当 `yt-dlp` 或 `ffmpeg` 不可用时，工具应退出并提示缺失或修复方式。

### 7.3 URL 校验

输入无效 URL：

```bash
ytdl-local "not-a-url"
```

应输出 URL 无效错误。

输入非 YouTube URL：

```bash
ytdl-local "https://example.com"
```

应提示只支持 YouTube URL。

### 7.4 下载视频

执行：

```bash
ytdl-local "https://www.youtube.com/watch?v=ggGc-u0lLYs" --out ./downloads-vp9 --cookies-from-browser chrome
```

应完成下载，并生成：

- `.mkv` 视频文件。
- 对应字幕文件。

执行高清码率模式：

```bash
ytdl-local "https://www.youtube.com/watch?v=lHJDH_LrIlc" --out ./downloads --cookies-from-browser chrome --quality sharp
```

应优先选择源站可用的高码率版本；如果源站最高只有 1080p，则不应伪造为 4K。

### 7.5 播放兼容性

下载后用 `ffprobe` 检查视频流：

```bash
ffprobe -hide_banner -show_streams -select_streams v:0 "<file>.mkv"
```

预期优先得到 VP9 视频流，而不是 AV1 视频流。

## 8. 合规边界

这是一个个人学习项目，用于学习 Node.js CLI、本地进程编排、`yt-dlp` 和 `ffmpeg` 的协作方式。

该工具仅用于下载用户有权下载、已获得授权，或 YouTube 明确允许下载的内容。

工具不应被设计为绕过平台限制、版权保护、DRM、付费墙或访问控制。

上传 GitHub 时只上传源码和文档，不上传下载产物、字幕文件、cookies 或任何登录态信息。

公开仓库描述和 README 必须明确：不得用于侵犯版权、搬运第三方视频、镜像受保护内容或违反平台条款。
