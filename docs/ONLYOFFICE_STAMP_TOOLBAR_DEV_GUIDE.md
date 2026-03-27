# ONLYOFFICE 印章插件开发手册（精简版）

用于后续 AI Agent 快速接手，优先解决“发布后还是旧版本”与“按钮行为异常”。

## 1. 快速入口

- 插件目录  
  `/Users/azo/Work-EMPOWER/demo-office/public/onlyoffice-plugins/empower-toolbar`
- 前端注入逻辑  
  `/Users/azo/Work-EMPOWER/demo-office/src/components/OnlyOfficeEditor.vue`
- 部署脚本  
  `/Users/azo/Work-EMPOWER/demo-office/scripts/deploy-plugin.sh`
- 环境变量  
  `/Users/azo/Work-EMPOWER/demo-office/.env.local`

## 2. 当前业务约束（必须保持）

1. 工具栏只保留一个按钮：`插入印章`（不是下拉）
2. 图标固定：`resources/icon.png`
3. 点击后选择图片并插入
4. `callCommand` 必须 `isClose=false`，否则按钮会消失

## 3. 发布步骤（标准流程）

```bash
pnpm deploy:plugin
```

然后：

1. 重启前端进程（让 env 生效）
2. 浏览器强刷

## 4. 缓存问题专项（重点）

### 4.1 为什么“无痕正常，普通模式旧版本”

常见是多层缓存叠加：

- 浏览器站点存储（不仅是 HTTP 缓存）
- Document Server 插件归档/残留目录
- 插件 URL 未变化导致命中旧资源

### 4.2 当前已落地的防缓存机制

1. `pluginsData` 使用绝对 URL 数组，且追加 `v + t` 参数  
2. 插件 `index.html` 加载 `main.js?v=<timestamp>`  
3. 部署脚本先删旧 GUID 目录再复制内容  
4. 部署脚本会删除历史 GUID 目录（防止误加载旧插件）

### 4.3 强制切断旧版本的方法（最有效）

当普通模式始终旧版本时，直接执行：

1. 更换插件 GUID（本项目已从 `...CF001` 切到 `...CF101`）
2. 更新 `.env.local` 里的插件 URL GUID
3. `pnpm deploy:plugin`
4. 重启前端

## 5. 关键配置（当前值）

- 插件 GUID：`asc.{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF101}`
- 远端插件 URL：  
  `VITE_ONLYOFFICE_TOOLBAR_PLUGIN_URL=http://localhost:80/sdkjs-plugins/{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF101}/config.json`
- 强制版本：  
  `VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION=20260327.8`

## 6. 快速排障索引（按症状）

### 症状 A：按钮显示旧文案/旧布局

检查顺序：

1. `pnpm deploy:plugin` 是否成功
2. 前端是否重启
3. `.env.local` 的 `GUID/版本号` 是否更新
4. 容器内脚本版本：

```bash
docker exec <容器名> sh -c "grep -n 'PLUGIN_VERSION' /var/www/onlyoffice/documentserver/sdkjs-plugins/{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF101}/scripts/main.js"
```

### 症状 B：点击按钮后工具栏消失

原因：`callCommand(..., true)` 关闭插件。  
修复：改成 `callCommand(..., false, true, callback)`。

### 症状 C：`translations/*.json` 404

检查是否存在：

- `translations/langs.json`
- `translations/zh-CN.json`
- `translations/en.json`

### 症状 D：插件加载 500

优先检查：

1. `config.json` 的 `baseUrl` 是否 `./`
2. `pluginsData` URL 是否可访问
3. 部署脚本是否把目录复制成了嵌套结构

## 7. 代码改动前后检查清单

提交前至少执行：

```bash
node --check public/onlyoffice-plugins/empower-toolbar/scripts/main.js
pnpm -s type-check
pnpm -s build
```

插件代码变更后必须：

1. bump `main.js` 中 `PLUGIN_VERSION`
2. bump `.env.local` 中 `VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION`

## 8. 官方资料（最少必看）

- 插件结构  
  https://api.onlyoffice.com/docs/plugin-and-macros/structure/getting-started/
- 自定义工具栏  
  https://api.onlyoffice.com/docs/plugin-and-macros/customization/toolbar/
- `pluginsData` 配置  
  https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/plugins/
- `ApiDrawing.SetWrappingStyle`  
  https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDrawing/Methods/SetWrappingStyle/
- `ApiDocument.AddDrawingToPage`  
  https://api.onlyoffice.com/docs/office-api/usage-api/text-document-api/ApiDocument/Methods/AddDrawingToPage/
