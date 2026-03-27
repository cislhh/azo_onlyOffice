# OnlyOffice 自定义工具栏插件接入手册

本文对应仓库内新增插件：`public/onlyoffice-plugins/empower-toolbar`  
插件 GUID：`asc.{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF001}`

## 1. 已完成的代码改造

- 编辑模式自动注入插件（`editorConfig.plugins.pluginsData + autostart`）
- 插件内新增自定义工具栏 Tab：`业务工具`
- 现有“插入印章”改为插件工具栏按钮触发
- 侧边栏原“插入印章”按钮已移除，后续功能请继续加到该工具栏 Tab

## 2. 本地开发（无需拷贝到容器）

当前代码默认从前端静态目录加载插件：

- 插件配置地址：`/onlyoffice-plugins/empower-toolbar/config.json`
- 运行：`pnpm dev`

注意：

- 若 Docs 服务与前端不同域，需允许跨域加载插件文件。当前 `vite.config.ts` 已启用 `server.cors = true`。

## 3. 生产/容器推荐方式（手动）

建议把插件放到 Document Server 的 `sdkjs-plugins` 目录，并通过环境变量指定插件 URL。

### 3.1 拷贝插件到容器

```bash
# 1) 找容器名
docker ps --filter "ancestor=onlyoffice/documentserver" --format "{{.Names}}"

# 2) 拷贝插件目录到容器（目录名用 GUID 去掉 asc. 前缀）
docker cp \
  /Users/azo/Work-EMPOWER/demo-office/public/onlyoffice-plugins/empower-toolbar \
  <容器名>:/var/www/onlyoffice/documentserver/sdkjs-plugins/\{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF001\}

# 3) 重启容器
docker restart <容器名>
```

### 3.2 前端配置插件地址

在前端环境变量中增加（仅在需要走容器插件时）：

```bash
VITE_ONLYOFFICE_TOOLBAR_PLUGIN_URL=http://<你的-docserver>/sdkjs-plugins/{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF001}/config.json
VITE_ONLYOFFICE_USE_REMOTE_TOOLBAR_PLUGIN=true
VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION=20260327.3
```

说明：

- 默认使用前端静态目录插件；只有 `VITE_ONLYOFFICE_USE_REMOTE_TOOLBAR_PLUGIN=true` 才会启用远端 URL。
- `VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION` 会拼到 URL 查询参数中，用于强制更新缓存。
- 适合生产环境统一由 Document Server 托管插件。

## 4. 插件功能说明

- 工具栏按钮 `插入印章`：
  - 选择图片（png/jpg/gif/webp）
  - 限制 5MB
  - 读取为 Base64 后直接插入（不依赖上传接口）

## 5. 常见坑：改了插件但页面还是旧版本

如果你把插件放在 Document Server 的 `sdkjs-plugins` 目录里，可能出现“重启容器、无痕模式后仍是旧代码”。

社区官方回复说明：

- 插件脚本可能会被归档缓存，编辑器继续从归档读取旧代码
- 建议优先使用 `pluginsData` 绝对 URL 方式加载插件，并给 URL 加版本号参数

参考：

- https://community.onlyoffice.com/t/why-does-plugin-not-update/12705
- https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/plugins/#pluginsdata
