# Kindle Oasis 3 → meDo → meMo

Kindle KUAL 插件发送新增的 My Clippings 文本到 `https://medo.ganlei.com/api/kclip`。Pages Function 复用现有 `TODO_DB` 绑定，写入现有 `tasks` 表，每批一条，带 `kclip` 和 `memo` 标签。meDo 下次同步读取记录；meMo 使用已有 meDo 拉取功能导入。

无需新建 Worker、数据库或提供数据库 ID。代码入口为 `functions/api/kclip.js`。设备端插件位于相邻 `myweb+kindle/kindle-kclip/extensions/kclip/`。

## 首次配置

1. 在 Cloudflare 控制台打开现有 meDo 的 D1 数据库，在 Console 执行 `migrations/001-kclip.sql` 内容。它只新增设备进度和回执两张表，不修改现有任务。
2. 在 meDo Pages 项目的 Settings → Variables and Secrets 中新增 Production 密钥 `KCLIP_TOKEN`，使用密码管理器生成至少 32 位随机字符串。同一密钥填入 Kindle 插件的 `config.sh`，不要在聊天或 Git 中公开。
3. 发布包含新接口的 meDo 项目。新增密钥后需重新部署才生效。
4. 如果域名受 Cloudflare Access 保护，给设备配置独立 Service Token，在该域名所属 Access 应用增加匹配该令牌的 Service Auth 策略；将 Client ID、Client Secret 填入 Kindle 配置。保持现有个人登录策略。不要为了设备上传放开整个域名。
5. 将 KUAL 插件的 `ENDPOINT` 填为上面的 `/api/kclip` 地址。复制插件到 Oasis 3，开启 Wi-Fi，点 KUAL 上传，再在 meDo 点击同步查看记录。

还没有完成线上部署或实机测试。若当前 Pages 没有绑定自定义域名，改用实际 Pages 域名。设备无需 Python，也不需要持有 Cloudflare 管理 API Token。

每批最多 20,000 Unicode 字符，与已有 meDo 备注限制一致；超限返回 413，设备保留上传进度。文件截断、旧内容变化或偏移冲突时停止，不自动重置。请保留设备插件中的 state 文件。服务器收到未完成的摘录时返回 422，稍后重试。


## 书库管理（2026-10-22）

在 https://medo.ganlei.com/books 使用与 meDo 相同的 Zero Trust 邮箱登录。支持 AZW3、PDF 原文件上传，单本不超过 20 MiB；网页标题自动带 Kclip-，不会改写书内标题。云端校验文件签名，以内容 SHA-256 去重。PDF 不转换成 AZW3。

点击每本书的“重新推送”会清除该书所有设备的下载回执，不删除 R2 文件。Kindle 下次手动执行“下载 R2 书籍”会再次处理；本地同名且完整的文件校验后复用，已删除的文件重新下载。删除书籍则移除云端文件、书单和回执，不修改 Kindle 本地文件。

Kindle 插件需要支持 .pdf 扩展名，文件仍保存到 `/mnt/us/documents/downloads/fromKclip/`。新增的 `kbook_formats` 表由接口自动建立，旧 AZW3 记录默认按 AZW3 处理，无需手动迁移。旧版 KBOOKS1 书单仅返回 AZW3。

验证：`node --test tests/kbooks.test.mjs tests/kbooks-admin.test.mjs`；设备脚本测试在相邻项目运行 `python kindle-kclip/test-download.py`，覆盖 AZW3/PDF、校验和、重试、完整文件复用及图书馆刷新调用。
