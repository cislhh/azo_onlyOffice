# OnlyOffice 开发手册

> 本文档整合了 OnlyOffice Document Server 在本地开发、插件开发、生产部署的完整指南，适用于后续正式生产开发。

**文档版本**: v1.0
**最后更新**: 2026-03-27
**适用范围**: OnlyOffice Document Server (Docker) + Vue 3

---

## 目录

1. [快速开始](#快速开始)
2. [环境搭建](#环境搭建)
3. [插件开发基础](#插件开发基础)
4. [自定义工具栏插件](#自定义工具栏插件)
5. [前端集成](#前端集成)
6. [常见问题与解决方案](#常见问题与解决方案)
7. [生产环境部署](#生产环境部署)
8. [附录](#附录)

---

## 快速开始

### 项目结构

```
demo-office/
├── public/onlyoffice-plugins/    # 插件源码目录
│   └── empower-toolbar/          # 自定义工具栏插件
├── src/components/
│   └── OnlyOfficeEditor.vue      # OnlyOffice 编辑器组件
├── scripts/
│   └── deploy-plugin.sh          # 插件部署脚本
├── docs/
│   └── ONLYOFFICE_DEVELOPMENT_GUIDE.md  # 本文档
└── .env.local                    # 环境变量配置
```

### 一键部署命令

```bash
# 部署插件到 Docker 容器
pnpm deploy:plugin

# 或直接执行脚本
./scripts/deploy-plugin.sh
```

---

## 环境搭建

### 开发环境配置

#### 1. 启动 OnlyOffice Docker 容器

```bash
docker run -i -t -d -p 80:80 \
  -e JWT_ENABLED=false \
  -e ONLYOFFICE_HTTPS_HSTS_ENABLED=false \
  -e ALLOW_PRIVATE_IP_ADDRESS=true \
  onlyoffice/documentserver
```

**关键环境变量**：
- `JWT_ENABLED=false` - 禁用 JWT 验证（本地开发）
- `ALLOW_PRIVATE_IP_ADDRESS=true` - **允许访问私有 IP 地址**（localhost/192.168.x.x）
- `ONLYOFFICE_HTTPS_HSTS_ENABLED=false` - 禁用 HSTS（本地开发）

#### 2. 配置前端环境变量

创建 `.env.local` 文件：

```bash
# OnlyOffice Document Server 地址
VITE_ONLYOFFICE_URL=http://localhost:80

# 文件访问主机（用于生成文件 URL）
VITE_FILE_ACCESS_HOST=192.168.0.196

# 最大文件大小（10MB）
VITE_MAX_FILE_SIZE=10485760

# 自定义工具栏插件配置（可选）
VITE_ONLYOFFICE_TOOLBAR_PLUGIN_URL=http://localhost:80/sdkjs-plugins/{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF102}/config.json
VITE_ONLYOFFICE_USE_REMOTE_TOOLBAR_PLUGIN=true
VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION=20260327.11
```

#### 3. 验证容器运行

```bash
# 检查容器状态
docker ps --filter "ancestor=onlyoffice/documentserver"

# 查看容器日志
docker logs <container-name> --tail 50

# 检查环境变量
docker inspect <container-name> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ALLOW
```

---

### 常见环境问题

#### 问题：文件下载失败

**症状**：
- 文件上传成功
- URL 转换正确（`http://192.168.0.196:5173/temp/file.docx`）
- OnlyOffice 编辑器提示"下载失败"

**根本原因**：
OnlyOffice Document Server 默认阻止访问私有 IP 地址（SSRF 防护）。

**解决方案**：
启动容器时添加 `-e ALLOW_PRIVATE_IP_ADDRESS=true`

**Docker 日志证据**：
```
Error: DNS lookup 192.168.0.196 is not allowed. Because, It is private IP address.
```

---

## 插件开发基础

### 插件目录结构

```
plugin-name/
├── config.json       # 插件配置文件（必需）
├── index.html        # 插件入口文件（必需）
├── scripts/          # JavaScript 脚本目录
│   └── main.js
├── resources/        # 资源文件目录
│   └── icon.png
└── translations/     # 多语言翻译目录（可选）
    ├── langs.json
    ├── zh-CN.json
    └── en.json
```

### config.json 配置说明

```json
{
  "name": "插件名称",
  "guid": "asc.{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF102}",
  "baseUrl": "./",
  "version": "1.0.0",
  "variations": [
    {
      "description": "插件描述",
      "url": "index.html",
      "icons": ["resources/icon.png"],
      "isViewer": false,
      "EditorsSupport": ["word", "cell", "slide", "pdf"],
      "type": "background",
      "initDataType": "none",
      "initData": "",
      "isUpdateOleOnResize": true,
      "events": ["onToolbarMenuClick"],
      "buttons": []
    }
  ]
}
```

**关键字段说明**：

| 字段 | 说明 | 可选值 |
|------|------|--------|
| `guid` | 全局唯一标识符 | 必须使用 `asc.{GUID}` 格式 |
| `EditorsSupport` | 支持的编辑器 | `word`, `cell`, `slide`, `pdf` |
| `type` | 插件类型 | `background`, `standard`, `unvisible` |
| `isViewer` | 是否在只读模式可用 | `true`, `false` |

### 插件类型说明

#### 1. background（后台插件）

**特点**：
- 不在工具栏显示
- 自定义工具栏 Tab
- 适用于：业务工具栏、扩展功能

**配置**：
```json
{
  "type": "background",
  "events": ["onToolbarMenuClick"]
}
```

#### 2. standard（标准插件）

**特点**：
- 在工具栏显示按钮
- 用户点击按钮后执行
- 适用于：插入内容、格式化、转换

**配置**：
```json
{
  "type": "standard",
  "buttons": [
    {
      "text": "按钮文字",
      "primary": true
    }
  ]
}
```

#### 3. unvisible（不可见插件）

**特点**：
- 不在工具栏显示按钮
- 文档打开时自动执行
- 适用于：水印、自动格式化、后台处理

**配置**：
```json
{
  "type": "unvisible",
  "buttons": []
}
```

### index.html 入口文件

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Plugin Name</title>
  <!-- ✅ 使用相对路径引用 SDK -->
  <script type="text/javascript" src="../pluginBase.js"></script>
  <script type="text/javascript" src="../v1/plugins.js"></script>
  <script type="text/javascript" src="../v1/plugins-ui.js"></script>
  <link rel="stylesheet" href="../plugins.css">
  <!-- 引用插件自己的脚本 -->
  <script type="text/javascript" src="scripts/main.js"></script>
</head>
<body>
</body>
</html>
```

**重要**：
- SDK 路径必须使用相对路径 `../`
- **不要使用绝对 URL**

### 插件脚本示例（scripts/main.js）

```javascript
(function(window, undefined){
  // 插件版本号（用于缓存控制）
  const PLUGIN_VERSION = '20260327.11';

  // 插件初始化
  window.Asc.plugin.init = function() {
    // 初始化逻辑
  };

  // 按钮点击事件
  window.Asc.plugin.button = function(id) {
    this.executeCommand("close", "");
  };

  // 工具栏菜单点击事件
  window.Asc.plugin.event_onToolbarMenuClick = function(id) {
    switch (id) {
      case 'insert-stamp':
        this.insertStamp();
        break;
      case 'more-features':
        this.showMoreFeatures();
        break;
    }
  };

})(window, undefined);
```

---

## 自定义工具栏插件

### 功能概述

本项目实现了自定义工具栏插件 `empower-toolbar`，提供：
- 自定义工具栏 Tab：**业务工具**
- 插入印章功能
- 文档对比功能（通过业务工具栏触发 compare）
- 可扩展的更多功能入口

### 插件配置

**插件 GUID**：`asc.{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF102}`

**前端注入**：
- 自动注入插件（`editorConfig.plugins.pluginsData + autostart`）
- 现有"插入印章"改为插件工具栏按钮触发
- 侧边栏原"插入印章"按钮已移除

### 开发流程

#### 1. 本地开发（无需拷贝到容器）

当前代码默认从前端静态目录加载插件：

- 插件配置地址：`/onlyoffice-plugins/empower-toolbar/config.json`
- 运行：`pnpm dev`

**注意**：若 Docs 服务与前端不同域，需允许跨域加载插件文件。当前 `vite.config.ts` 已启用 `server.cors = true`。

#### 2. 生产/容器部署（推荐）

建议把插件放到 Document Server 的 `sdkjs-plugins` 目录：

```bash
# 一键部署
pnpm deploy:plugin
```

或手动执行：

```bash
# 1) 拷贝插件到容器
docker cp \
  public/onlyoffice-plugins/empower-toolbar \
  <容器名>:/var/www/onlyoffice/documentserver/sdkjs-plugins/\{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF102\}

# 2) 重启容器
docker restart <容器名>
```

#### 3. 前端配置插件地址

在 `.env.local` 中添加：

```bash
VITE_ONLYOFFICE_TOOLBAR_PLUGIN_URL=http://localhost:80/sdkjs-plugins/{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF102}/config.json
VITE_ONLYOFFICE_USE_REMOTE_TOOLBAR_PLUGIN=true
VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION=20260327.11
```

**说明**：
- 默认使用前端静态目录插件
- 只有 `VITE_ONLYOFFICE_USE_REMOTE_TOOLBAR_PLUGIN=true` 才会启用远端 URL
- `VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION` 会拼到 URL 查询参数中，用于强制更新缓存

### 部署脚本

**位置**：`scripts/deploy-plugin.sh`

**功能**：
- 自动检测 OnlyOffice 容器
- 复制插件到容器
- 清理旧版本插件
- 重启容器
- 清理插件归档缓存

**使用**：
```bash
# 使用环境变量指定容器名
ONLYOFFICE_CONTAINER_NAME=my-container ./scripts/deploy-plugin.sh

# 或自动检测容器
./scripts/deploy-plugin.sh
```

### 功能说明

#### 插入印章

- 选择图片（png/jpg/gif/webp）
- 限制 5MB
- 读取为 Base64 后直接插入（不依赖上传接口）
- 自动浮动在右下角
- 浮于文字上方
- 固定尺寸（可配置）

#### 更多功能

- 预留入口，后续业务功能统一从这里扩展

### 缓存问题专项

#### 为什么"无痕正常，普通模式旧版本"

常见是多层缓存叠加：
- 浏览器站点存储（不仅是 HTTP 缓存）
- Document Server 插件归档/残留目录
- 插件 URL 未变化导致命中旧资源

#### 当前防缓存机制

1. `pluginsData` 使用绝对 URL 数组，且追加 `v + t` 参数
2. 插件 `index.html` 加载 `main.js?v=<timestamp>`
3. 部署脚本先删旧 GUID 目录再复制内容
4. 部署脚本会删除历史 GUID 目录（防止误加载旧插件）

#### 强制切断旧版本的方法

当普通模式始终旧版本时，直接执行：

1. 更换插件 GUID（如从 `...CF001` 切到 `...CF102`）
2. 更新 `.env.local` 里的插件 URL GUID
3. `pnpm deploy:plugin`
4. 重启前端

---

## 前端集成

### OnlyOfficeEditor 组件

**位置**：`src/components/OnlyOfficeEditor.vue`

#### 关键配置

```typescript
const config = computed<OnlyOfficeConfig | null>(() => {
  return {
    document: {
      fileType,
      key,
      title: props.file?.name || 'document',
      url: finalUrl,
      permissions: {
        edit: isEditMode,
        download: true,
        print: true
      }
    },
    editorConfig: {
      mode: isCompareMode ? 'edit' : props.mode,
      callbackUrl: isEditMode ? getCallbackUrl() : undefined,
      lang: 'zh-CN',
      customization: {
        uiTheme: theme.value === 'dark' ? 'theme-dark' : 'theme-light',
        // ...其他自定义配置
      },
      plugins: {
        // 自定义插件配置
        pluginsData: toolbarPluginUrl.value ? [{
          name: 'empower-toolbar',
          guid: toolbarPluginGuid.value,
          url: toolbarPluginUrl.value,
          isViewer: false,
          editorsSupport: ['word', 'cell', 'slide', 'pdf']
        }] : []
      }
    },
    // ...
  }
})
```

### 主题切换

#### 问题：主题切换时界面不变

**症状**：
- 默认浅色正常
- 切换深色时界面不变
- 控制台报错：`TypeError: Cannot read properties of null (reading 'postMessage')`

**根本原因**：
- 主题切换时引入了**动态 `key` + 动态 `editor-id`**，导致 `OnlyOfficeEditor` 被强制卸载并重建
- 同时，`@onlyoffice/document-editor-vue` 在 `config` 变化时本身也会执行 `destroyEditor() -> onLoad()`
- 两套重建机制叠加后出现竞态

#### 修复方案

- 移除动态 `key` 和动态 `editor-id`，保持编辑器实例稳定
- 仅通过配置更新主题：`editorConfig.customization.uiTheme`
- 当前使用：`theme-light` / `theme-dark`，默认 `theme-light`

**结论**：
对 OnlyOffice 这类 iframe 编辑器，优先保持实例稳定，避免手动 remount。

---

## 常见问题与解决方案

### 问题 1：插件没有生效？

**检查清单**：

1. ✅ 容器是否重启？
   ```bash
   docker restart <容器名>
   ```

2. ✅ SDK 路径是否使用相对路径？
   ```html
   <!-- ❌ 错误 -->
   <script src="http://192.168.0.134:8080/sdkjs-plugins/v1/plugins.js"></script>

   <!-- ✅ 正确 -->
   <script src="../v1/plugins.js"></script>
   ```

3. ✅ 目录名是否与 GUID 匹配？
   ```bash
   # config.json 中的 guid
   "guid": "asc.{6B5A1D6E-C1B5-4C8E-9E5A-7D1E8F2B5C3D}"

   # 目录名必须是
   {6B5A1D6E-C1B5-4C8E-9E5A-7D1E8F2B5C3D}
   ```

4. ✅ 浏览器是否缓存了旧版本？
   - 按 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（macOS）强制刷新

### 问题 2：修改插件代码后重新部署？

```bash
# 1. 修改本地文件
vim public/onlyoffice-plugins/empower-toolbar/scripts/main.js

# 2. 重新部署
pnpm deploy:plugin

# 3. 更新版本号（重要！）
# 修改 main.js 中的 PLUGIN_VERSION
# 修改 .env.local 中的 VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION
```

### 问题 3：点击按钮后工具栏消失

**原因**：`callCommand(..., true)` 关闭插件

**修复**：改成 `callCommand(..., false, true, callback)`

### 问题 4：`translations/*.json` 404

**检查**：
- `translations/langs.json` 是否存在
- `translations/zh-CN.json` 是否存在
- `translations/en.json` 是否存在

### 问题 5：插件加载 500

**优先检查**：
1. `config.json` 的 `baseUrl` 是否为 `./`
2. `pluginsData` URL 是否可访问
3. 部署脚本是否把目录复制成了嵌套结构

---

## 生产环境部署

### 环境变量对比

| 变量 | 开发环境 | 生产环境 |
|------|----------|----------|
| `VITE_ONLYOFFICE_URL` | `http://localhost:80` | `https://docs.yourdomain.com` |
| `JWT_ENABLED` | `false` | `true` |
| `ALLOW_PRIVATE_IP_ADDRESS` | `true` | `false` |
| `JWT_SECRET` | 不需要 | **必须配置** |

### Docker 启动命令对比

#### 开发环境

```bash
docker run -i -t -d -p 80:80 \
  -e JWT_ENABLED=false \
  -e ONLYOFFICE_HTTPS_HSTS_ENABLED=false \
  -e ALLOW_PRIVATE_IP_ADDRESS=true \
  onlyoffice/documentserver
```

#### 生产环境

```bash
docker run -i -t -d -p 80:80 \
  -e JWT_ENABLED=true \
  -e JWT_SECRET=your-super-secret-jwt-key \
  -e JWT_HEADER=Authorization \
  -e JWT_IN_BODY=true \
  -e ALLOW_PRIVATE_IP_ADDRESS=false \
  onlyoffice/documentserver
```

**关键安全配置**：
- `JWT_ENABLED=true` - **必须启用 JWT 验证**
- `JWT_SECRET` - 使用强随机密钥（至少 32 字符）
- `ALLOW_PRIVATE_IP_ADDRESS=false` - **禁止私有 IP 访问**

### OnlyOfficeEditor 配置调整

在生产环境中，需要在配置中添加 JWT token：

```typescript
const config = computed<OnlyOfficeConfig | null>(() => {
  const token = props.mode === 'edit'
    ? generateJwtToken(finalUrl, props.mode)
    : undefined

  return {
    document: {
      fileType,
      key,
      title: props.file?.name || 'document',
      url: finalUrl,
      token, // 添加 JWT token
      permissions: {
        edit: isEditMode,
        download: true,
        print: true
      }
    },
    editorConfig: {
      mode: isCompareMode ? 'edit' : props.mode,
      callbackUrl: isEditMode ? getCallbackUrl() : undefined,
      token: isEditMode ? generateEditorToken() : undefined,
      lang: 'zh-CN'
    },
    // ...
  }
})
```

### 生产环境额外要求

#### 1. 文件存储

**开发环境**：
- 文件存储在 `public/temp/` 目录
- 通过 Vite 静态文件服务访问

**生产环境**：
- 使用对象存储服务（AWS S3、阿里云 OSS、腾讯云 COS）
- 文件 URL：`https://your-bucket.s3.amazonaws.com/temp/file.docx`
- 设置合适的 CORS 策略

#### 2. 回调 URL（Callback URL）

**开发环境**：
- 可以留空或使用 `http://localhost:5173/api/callback`
- 不需要真实实现保存功能

**生产环境**：
- 必须提供有效的回调 URL
- 回调接口需要：
  - 验证 JWT 签名
  - 处理文档保存事件
  - 返回特定 JSON 格式响应

```typescript
app.post('/api/callback', (req, res) => {
  const { status, key, url } = req.body

  if (status === 2) {
    // 保存文档
    // ...
    res.json({ error: 0 })
  } else if (status === 6 || status === 7) {
    // 文档正在编辑或已关闭
    res.json({ error: 0 })
  }
})
```

#### 3. HTTPS

**开发环境**：
- 使用 HTTP 即可

**生产环境**：
- **必须使用 HTTPS**
- OnlyOffice 和前端应用都需要 HTTPS
- 配置有效的 SSL 证书

### 安全性检查清单

生产环境部署前必须确认：

- [ ] JWT 验证已启用（`JWT_ENABLED=true`）
- [ ] JWT_SECRET 使用强随机密钥
- [ ] 禁止私有 IP 访问（`ALLOW_PRIVATE_IP_ADDRESS=false`）
- [ ] 所有服务使用 HTTPS
- [ ] 回调 URL 已实现并测试
- [ ] 文件存储使用对象存储服务
- [ ] CORS 策略正确配置
- [ ] 防火墙规则正确配置

---

## 附录

### 生成新的插件 GUID

```bash
# 方式 1: 命令行
uuidgen

# 方式 2: Node.js
node -e "console.log(require('crypto').randomUUID())"

# 方式 3: Python
python3 -c "import uuid; print(uuid.uuid4())"
```

输出示例：`a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d`

### 常用路径

| 项目 | 路径 |
|------|------|
| 插件安装目录 | `/var/www/onlyoffice/documentserver/sdkjs-plugins/` |
| SDK 基础文件 | `/var/www/onlyoffice/documentserver/sdkjs-plugins/pluginBase.js` |
| SDK v1 目录 | `/var/www/onlyoffice/documentserver/sdkjs-plugins/v1/` |

### 常用 Docker 命令

```bash
# 查看容器
docker ps --filter "ancestor=onlyoffice/documentserver"

# 查看日志
docker logs <container-name> --tail 50

# 进入容器
docker exec -it <container-name> bash

# 查看环境变量
docker inspect <container-name> --format '{{range .Config.Env}}{{println .}}{{end}}'

# 重启容器
docker restart <container-name>

# 删除插件
docker exec <container-name> rm -rf /var/www/onlyoffice/documentserver/sdkjs-plugins/{GUID}

# 查看所有插件
docker exec <container-name> ls -la /var/www/onlyoffice/documentserver/sdkjs-plugins/
```

### 代码改动检查清单

提交前至少执行：

```bash
# 检查 JavaScript 语法
node --check public/onlyoffice-plugins/empower-toolbar/scripts/main.js

# 类型检查
pnpm -s type-check

# 构建检查
pnpm -s build
```

插件代码变更后必须：

1. bump `main.js` 中 `PLUGIN_VERSION`
2. bump `.env.local` 中 `VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION`

### 官方资料

- [OnlyOffice 插件开发官方文档](https://api.onlyoffice.com/docbuilder/basic-how-to-work-with-plugins)
- [OnlyOffice 插件 API 参考](https://api.onlyoffice.com/plugin/)
- [OnlyOffice 插件示例（GitHub）](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/plugins)
- [OnlyOffice Vue 集成文档](https://api.onlyoffice.com/zh-CN/docs/docs-api/get-started/frontend-frameworks/vue/)
- [自定义工具栏文档](https://api.onlyoffice.com/docs/plugin-and-macros/customization/toolbar/)
- [pluginsData 配置](https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/plugins/)

### 扩展：生产方案"服务端取印章"

目标：点击 `插入印章` 后，不允许用户本地上传，改为从后端接口获取印章图片。

#### 可行性结论

- 可行。插件是运行在编辑器中的 HTML/JS 页面，可以发网络请求
- `pluginsData` 仍保持绝对 URL 数组，不影响该方案
- 只需把当前"本地文件选择"替换为"请求后端接口"

#### 推荐接口契约

```
GET /api/stamp/current
```

返回建议二选一：

1. `{"imageBase64":"data:image/png;base64,..."}`（推荐）
2. `{"imageUrl":"https://.../stamp.png?token=...&expires=..."}`

建议优先 `imageBase64`（避免外链缓存和鉴权泄露）。

#### 插件改造点

当前在 `scripts/main.js` 的流程是：

1. 点击按钮 -> `openImagePicker()`
2. 读本地图片 -> `insertStampImage(...)`

改造后：

1. 点击按钮 -> `fetch('/api/stamp/current', ...)`
2. 读取 `imageBase64` 或下载后转 base64
3. 继续调用现有 `insertStampImage(...)`

**注意**：
- 保持 `callCommand(..., false, true, callback)`，不要关闭插件
- 插入位置/尺寸逻辑保持不变（右下角 + 固定大小 + 浮于文字上方）

#### 生产安全清单

1. **接口鉴权**：必须绑定用户/租户身份
2. **权限控制**：按角色限制可用印章
3. **防重放**：若用 URL，建议短时签名（分钟级）
4. **CORS**：仅放行受信任来源（ONLYOFFICE 页面域名）
5. **审计**：记录用户、文档、时间、印章版本
6. **资源策略**：印章图片建议 `Cache-Control: no-store` 或短缓存

#### 上线检查

1. 普通模式与无痕模式都验证一次
2. 校验容器内插件版本号是否最新
3. 校验后端接口在 token 过期后是否拒绝访问
4. 校验无权限用户是否无法获取印章

---

## 快速参考

### 开发 vs 生产环境配置速查表

| 配置项 | 开发环境 | 生产环境 |
|--------|---------|----------|
| **Docker 启动** | | |
| JWT_ENABLED | `false` | `true` |
| ALLOW_PRIVATE_IP_ADDRESS | `true` | `false` |
| JWT_SECRET | 不需要 | 强随机密钥（32+字符） |
| **前端环境变量** | | |
| VITE_ONLYOFFICE_URL | `http://localhost:80` | `https://docs.yourdomain.com` |
| VITE_FILE_ACCESS_HOST | `192.168.0.196` | 公网域名 |
| VITE_ONLYOFFICE_JWT_SECRET | 不需要 | 与容器相同 |
| **文件存储** | | |
| 存储位置 | `public/temp/` | 对象存储（S3/OSS） |
| URL 格式 | `http://192.168.0.196:5173/...` | `https://bucket.s3.amazonaws.com/...` |
| **回调 URL** | | |
| callbackUrl | 可留空 | 必须（JWT 验证 + 保存逻辑） |
| **HTTPS** | | |
| 协议 | HTTP | **必须 HTTPS** |
| SSL 证书 | 不需要 | 有效证书 |

### 插件类型速查表

| 类型 | 工具栏显示 | 执行时机 | 适用场景 | 配置 |
|------|-----------|---------|---------|------|
| `background` | 自定义 Tab | 用户点击 | 业务工具栏 | `"type": "background"`<br>`"events": ["onToolbarMenuClick"]` |
| `standard` | 按钮 | 用户点击 | 插入内容、格式化 | `"type": "standard"`<br>`"buttons": [...]` |
| `unvisible` | 不显示 | 文档打开时 | 水印、自动处理 | `"type": "unvisible"`<br>`"buttons": []` |

### 常见问题速查表

| 症状 | 可能原因 | 解决方案 |
|------|---------|---------|
| 文件下载失败 | 容器阻止私有 IP | 添加 `-e ALLOW_PRIVATE_IP_ADDRESS=true` |
| 插件未生效 | 容器未重启 | `docker restart <容器名>` |
| 按钮显示旧文案 | 浏览器缓存 | 强制刷新（`Ctrl+Shift+R`） |
| 普通模式旧版本 | 多层缓存 | 更换 GUID + 更新版本号 |
| 点击后工具栏消失 | `callCommand` 关闭插件 | 改为 `callCommand(..., false, true, callback)` |
| 主题切换失效 | 实例被重建 | 移除动态 `key`，仅更新 `uiTheme` |
| translations 404 | 缺少翻译文件 | 检查 `translations/` 目录 |

---

**文档结束**

如有问题，请参考官方文档或查看项目中的具体实现代码。
