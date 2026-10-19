# Kindle 书籍分发

R2 私有桶 `kindle-books` 绑定为 `KINDLE_BOOKS`，D1 沿用 `TODO_DB`。
部署后首次授权请求自动创建 `kbooks`、`kbook_receipts` 两张独立表，不修改任务表。

Pages 生产环境另设密钥 `KBOOK_UPLOAD_TOKEN`：至少 32 位随机字符，与
`KCLIP_TOKEN` 不同。电脑上传使用前者；Kindle 领取书籍使用现有后者。
现有 Cloudflare Access Service Auth 策略保护整个同域接口。

接口 `/api/kbooks`：
- POST `?op=upload&title=URL编码书名`：原始 AZW3 字节，最大 20 MiB；返回 JSON 回执。
- GET `?op=list&device=oasis3`：`KBOOKS1` 首行，其后每行 SHA256、制表符、字节数；每批最多 100 本。
- GET `?op=list&device=oasis3&format=2`：首行 `KBOOKS2`、制表符、服务端 Unix 秒数；后续行依次为 SHA256、字节数、安全文件名（制表符分隔）。旧版书单保持兼容。
- GET `?op=meta&id=SHA256`：书籍标题、大小、安全文件名，用于已有文件整理。
- GET `?op=file&id=SHA256`：文件流。
- POST `?op=ack&device=oasis3&id=SHA256`：需 `X-Book-SHA256` 同值，返回 `OK SHA256`。

所有请求使用 Bearer 密钥及现有 Access 服务凭证。上传使用内容寻址，重复文件不重复入队；
先写 R2 后登记 D1，失败可重试。回执按设备独立记录。已领取后不会因 Kindle 删除文件自动重发。
R2 内以 SHA256.azw3 保存；Kindle 文件名为“Kclip-书名 [8位编号].azw3”，UTF-8 长度受控并过滤路径及 FAT 非法字符。前缀只加一次；原生书库中的标题由书籍内部元数据决定。
格式检查验证 BOOKMOBI 容器签名，并非完整的 AZW3 内容有效性验证。

电脑工具为相邻 myweb+kindle/kindle-kclip/upload-book.py（仅标准库，支持 Windows/macOS/Linux）。
配置环境变量 `KBOOK_UPLOAD_TOKEN`、`KBOOK_ACCESS_CLIENT_ID`、`KBOOK_ACCESS_CLIENT_SECRET`；
可选 `KBOOK_ENDPOINT`，默认 https://medo.ganlei.com/api/kbooks。也可将同名字段保存在
`~/.config/kindle-delivery/config.json`，或通过 `--config` 指定外部 JSON 配置；环境变量优先。
运行 `python upload-book.py 文件.azw3`。密钥不放在命令行参数或仓库里。

Kindle 增加 download.sh、sync.sh 及新版 menu.json，保留 config.sh 和摘录进度文件。
下载到 `/mnt/us/documents/downloads/fromKclip/`，要求设备已有 curl、sha256sum；
临时文件校验后才改名，再落盘和回执。失败后再次点击即可，已存在文件校验不符时停止该文件，绝不覆盖。
可在 config.sh 指定 BOOKS_ENDPOINT，默认从现有 ENDPOINT 的 /kclip 推导为 /kbooks。
下载完成通过 `com.lab126.scanner reScanFile` 请求扫描该文件；失败时退回 `doFullScan`。
另提供 KUAL 的 Refresh library 入口。扫描为异步操作，兼容性仍需 Oasis 3 实机验证。
日志为 download-scan.txt、download-diagnostics.txt；不自动重启原生阅读器。
KUAL 的 Kclip 子菜单按编号排列上传、下载、同步、全量重传、刷新。
统一 notify.sh 使用现有 FBInk 和 KOReader 中文字体，按实际屏幕宽度绘制黑色横条、白色 96px 中文提示；不支持 OpenType 的旧 FBInk 降级为大号英文。显示诊断见 notify-error.txt。
时间使用书单返回的服务端时间，不改 Kindle 系统时钟；对这台设备的 UTC FAT 挂载，
默认 `KBOOK_FAT_OFFSET_SECONDS=28800` 修正 Windows USB 查看时少八小时的问题。
如换用已按本地时区挂载的设备，需在 config.sh 设置该值为 0。这个兼容处理只影响书籍文件时间。
