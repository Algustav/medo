# meDo

meDo 是一个轻量的个人待办工具，适合部署到 Cloudflare Pages：

- 任务支持标签/分类
- 支持拖动排序
- 标题和备注里的网址会自动识别为可点击链接
- 支持多套主题模板
- 使用 Cloudflare Pages Functions 连接 D1 数据库
- 本地离线可用，离线期间的新增、修改、删除、排序会先保存到浏览器，恢复网络后同步到 D1
- 移动端紧凑布局，长备注默认显示一行 `...更多`，点击展开

## 本地预览

不要直接双击 `index.html`，需要通过本地 HTTP 服务访问：

```bash
python -m http.server 9876
```

然后打开：

```text
http://localhost:9876
```

本地静态服务没有 `/api/tasks`，所以页面会自动进入本地离线模式，数据保存在浏览器 `localStorage` 中。

## Cloudflare Pages + D1 部署

### 1. 创建 D1 数据库

在 Cloudflare 控制台进入 **Storage & Databases → D1 SQL Database**，创建数据库，例如：

```text
medo
```

然后在 D1 控制台执行 [schema.sql](./schema.sql) 中的 SQL。

### 2. 部署到 Cloudflare Pages

把项目提交到 GitHub/GitLab，然后在 Cloudflare **Workers & Pages** 创建 Pages 项目：

- Framework preset: `None`
- Build command: 留空
- Build output directory: `/`

### 3. 绑定 D1

进入 Pages 项目：

```text
Settings → Bindings → Add binding → D1 database
```

填写：

- Variable name: `TODO_DB`
- D1 database: 选择你的 `medo`

保存后重新部署一次。Pages Functions 会通过 `functions/api/tasks.js` 暴露 `/api/tasks`，前端会自动使用它同步数据。

该只读接口允许 `http://localhost:43117` 在携带 Cloudflare Access Cookie 时读取任务，供本地 meMo 拉取带有 `memo` 标签的项目。CORS 仅开放 `GET/OPTIONS`，新增、修改和删除接口不向该来源开放。若浏览器阻止跨站 Access Cookie，`/memo-bridge.html` 会在 meDo 顶层窗口完成验证，只把带 `memo` 标签的活动及归档项目发送回本地 meMo。

## 离线同步说明

页面会缓存静态资源，所以部署后访问过一次，之后断网也能打开。任务数据会先写入本地：

- 在线时：写入本地，同时提交到 D1
- 离线时：写入本地，并记录待同步操作
- 恢复网络或点击“同步”时：按顺序把离线操作提交到 D1，然后重新拉取云端清单

这是一个个人工具的简洁同步模型。如果多个设备同时离线编辑同一条任务，最后同步的一方会覆盖同字段的旧值。

## 链接识别

标题和备注支持自动识别：

- `https://example.com`
- `http://example.com`
- `www.example.com`

链接会在新标签页中打开。

## 使用 Wrangler（可选）

复制 `wrangler.example.toml` 为 `wrangler.toml`，填入 D1 Database ID 后，可以用 Wrangler 做本地 Pages Functions 模拟或数据库迁移。

## 私有访问建议

这个工具默认没有账号系统。建议用 Cloudflare Zero Trust Access 保护整个 Pages 域名，只允许你自己的邮箱访问。

### 启动缓存与版本更新

应用启动先读取本地任务，随后在后台同步云端。Service Worker 安装完成后，首页及版本化的脚本、样式、图标优先从本地缓存读取，不等待网络；首页的查询参数（例如 `?theme=...`）也支持离线打开。API 和非应用资源不进入此缓存。

首次访问仍需要联网，并等待静态资源缓存安装完成。发布新版本时，必须同时更新 `sw.js` 的缓存名称，并确保 `APP_SHELL` 中的资源 URL 与 HTML、模块 import 完全一致。新缓存完整安装后，会在旧版本的所有页面/主屏幕窗口关闭后启用；更新后请关闭所有 meDo 窗口再重新打开。此策略避免正在使用的页面混用新旧脚本。缓存更新不会清除本地任务或待同步操作。

建议在 iPhone 上验证：联网访问并等待缓存安装，关闭应用，开启飞行模式后从主屏幕打开；确认任务显示、可以新增任务，再关闭并重开确认保留；最后恢复联网，确认待同步操作正常提交。浏览器缓存被系统或用户清除后，需要再次联网安装。