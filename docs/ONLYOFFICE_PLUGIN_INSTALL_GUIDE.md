# OnlyOffice Docker 插件安装指南

> 本文档以水印插件（watermark_plugin）为例，讲解如何在 OnlyOffice Docker 容器中安装自定义插件。

---

## 目录

1. [前置条件](#前置条件)
2. [插件结构说明](#插件结构说明)
3. [安装步骤](#安装步骤)
4. [验证插件](#验证插件)
5. [插件类型说明](#插件类型说明)
6. [常见问题](#常见问题)

---

## 前置条件

### 1. OnlyOffice Docker 容器已运行

```bash
# 查看正在运行的 OnlyOffice 容器
docker ps --filter "ancestor=onlyoffice/documentserver"
```

**输出示例**：
```
CONTAINER ID   NAMES           STATUS          PORTS
89129260ff55   jolly_lewin      Up 3 minutes    0.0.0.0:80->80/tcp
```

### 2. 插件目录已准备好

插件目录应包含以下文件：
```
watermark_plugin/
├── config.json       # 插件配置文件（必需）
├── index.html        # 插件入口文件（必需）
├── scripts/          # JavaScript 脚本目录
│   └── addWatermark2.js
├── resources/        # 资源文件目录
│   ├── icon.png
│   └── watermark.png
└── translations/     # 多语言翻译目录
```

---

## 插件结构说明

### config.json - 插件配置文件

```json
{
  "name": "一键水印",                    // 插件名称
  "guid": "asc.{6B5A1D6E-C1B5-4C8E-9E5A-7D1E8F2B5C3D}",  // 全局唯一标识符
  "group": {
    "name": "plugins",
    "rank": 2
  },
  "variations": [
    {
      "description": "hello world",     // 插件描述
      "url": "index.html",              // 入口文件
      "icons": ["resources/icon.png"],  // 插件图标
      "isViewer": false,                // 是否在查看模式中可用
      "EditorsSupport": ["word"],       // 支持的编辑器（word/cell/spreadsheet）
      "type": "unvisible",              // 插件类型（见下文说明）
      "initDataType": "none",
      "initData": "",
      "isUpdateOleOnResize": true,
      "buttons": []
    }
  ]
}
```

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `guid` | 全局唯一标识符，**插件目录名必须使用此值** |
| `EditorsSupport` | 支持的编辑器：`"word"`（文档）、`"cell"`（表格）、`"slide"`（演示） |
| `type` | 插件类型：`"unvisible"`（自动运行）、`"standard"`（工具栏按钮） |
| `isViewer` | 是否在只读模式中可用 |

### index.html - 插件入口文件

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Hello world</title>
  <!-- ✅ 使用相对路径引用 SDK -->
  <script type="text/javascript" src="../pluginBase.js"></script>
  <script type="text/javascript" src="../v1/plugins.js"></script>
  <script type="text/javascript" src="../v1/plugins-ui.js"></script>
  <link rel="stylesheet" href="../plugins.css">
  <!-- 引用插件自己的脚本 -->
  <script type="text/javascript" src="scripts/addWatermark2.js"></script>
</head>
<body>
</body>
</html>
```

**重要**：SDK 路径必须使用相对路径 `../`，**不要使用绝对 URL**。

---

## 安装步骤

### 步骤 1：检查并修复 index.html 中的 SDK 路径

**❌ 错误示例**（使用绝对 URL）：
```html
<script type="text/javascript" src="http://192.168.0.134:8080/sdkjs-plugins/v1/plugins.js"></script>
```

**✅ 正确示例**（使用相对路径）：
```html
<script type="text/javascript" src="../v1/plugins.js"></script>
```

### 步骤 2：获取容器名称

```bash
docker ps --filter "ancestor=onlyoffice/documentserver" --format "{{.Names}}"
```

**输出示例**：
```
jolly_lewin
```

### 步骤 3：复制插件到容器

**关键点**：插件目录名必须使用 `config.json` 中的 `guid` 值（去掉 `asc.` 前缀）。

```bash
# 格式：docker cp <本地插件路径> <容器名>:<目标路径>
docker cp \
  ~/Work-EMPOWER/watermark_plugin \
  jolly_lewin:/var/www/onlyoffice/documentserver/sdkjs-plugins/\{6B5A1D6E-C1B5-4C8E-9E5A-7D1E8F2B5C3D\}
```

**注意**：
- 花括号 `{}` 需要使用反斜杠 `\` 转义
- GUID 必须与 `config.json` 中完全一致
- 目标路径固定为：`/var/www/onlyoffice/documentserver/sdkjs-plugins/`

### 步骤 4：验证文件已复制

```bash
docker exec jolly_lewin ls -la \
  /var/www/onlyoffice/documentserver/sdkjs-plugins/\{6B5A1D6E-C1B5-4C8E-9E5A-7D1E8F2B5C3D\}/
```

**预期输出**：
```
total 48
drwxrwxrwx 5 501 dialout  4096 Mar 25 08:07 .
dr-xr-xr-x 1 ds  ds       4096 Mar 25 08:07 ..
-rwxrwxrwx 1 501 dialout   518 Mar 23 08:51 config.json
-rwxrwxrwx 1 501 dialout   439 Mar 25 08:07 index.html
drwxrwxrwx 2 501 dialout  4096 Mar 23 08:51 resources
drwxrwxrwx 2 501 dialout  4096 Mar 24 09:33 scripts
drwxrwxrwx 2 501 dialout  4096 Mar 24 09:33 translations
```

### 步骤 5：重启容器

```bash
docker restart jolly_lewin
```

### 步骤 6：确认容器重启成功

```bash
docker ps --filter "name=jolly_lewin" --format "{{.Names}}\t{{.Status}}"
```

**预期输出**：
```
jolly_lewin    Up 20 seconds
```

---

## 验证插件

### 方法 1：查看浏览器开发者工具

1. 打开 OnlyOffice 编辑器
2. 按 `F12` 打开开发者工具
3. 切换到 **Console** 标签
4. 查找插件加载日志

### 方法 2：检查插件是否自动执行

对于 `unvisible` 类型插件：
1. 创建或打开一个 Word 文档
2. 检查是否自动出现水印或其他插件效果

### 方法 3：查看网络请求

1. 打开开发者工具 → **Network** 标签
2. 刷新页面
3. 搜索插件名称（如 `watermark` 或 GUID）
4. 确认插件资源是否成功加载

---

## 插件类型说明

### 1. unvisible（不可见插件）

**特点**：
- 不在工具栏显示按钮
- 文档打开时自动执行
- 适用于：水印、自动格式化、后台处理等

**config.json 配置**：
```json
{
  "type": "unvisible",
  "buttons": []
}
```

**示例代码**：
```javascript
window.Asc.plugin.init = function() {
  this.callCommand(function() {
    // 自动执行的代码
    var doc = Api.GetDocument();
    var watermarkSettings = doc.GetWatermarkSettings();
    // ...
  }, true);
};
```

### 2. standard（标准插件）

**特点**：
- 在工具栏显示按钮
- 用户点击按钮后执行
- 适用于：插入内容、格式化、转换等

**config.json 配置**：
```json
{
  "type": "standard",
  "buttons": [
    {
      "text": "插入水印",
      "primary": true
    }
  ]
}
```

**示例代码**：
```javascript
window.Asc.plugin.button = function(id) {
  // 按钮点击时执行
  this.executeCommand("close", "");
};
```

---

## 常见问题

### Q1: 插件没有生效？

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

### Q2: 如何修改插件代码后重新部署？

```bash
# 1. 修改本地文件
vim ~/Work-EMPOWER/watermark_plugin/scripts/addWatermark2.js

# 2. 重新复制到容器
docker cp \
  ~/Work-EMPOWER/watermark_plugin \
  jolly_lewin:/var/www/onlyoffice/documentserver/sdkjs-plugins/\{6B5A1D6E-C1B5-4C8E-9E5A-7D1E8F2B5C3D\}

# 3. 重启容器
docker restart jolly_lewin
```

### Q3: 如何查看容器内的所有插件？

```bash
docker exec jolly_lewin ls -la /var/www/onlyoffice/documentserver/sdkjs-plugins/
```

### Q4: 如何删除插件？

```bash
# 1. 删除插件目录
docker exec jolly_lewin rm -rf \
  /var/www/onlyoffice/documentserver/sdkjs-plugins/\{6B5A1D6E-C1B5-4C8E-9E5A-7D1E8F2B5C3D\}

# 2. 重启容器
docker restart jolly_lewin
```

### Q5: 支持哪些文档类型？

根据 `config.json` 中的 `EditorsSupport` 字段：

| 值 | 支持的编辑器 | 文件类型 |
|---|------------|---------|
| `"word"` | Document Editor | `.docx`, `.doc` |
| `"cell"` | Spreadsheet Editor | `.xlsx`, `.xls` |
| `"slide"` | Presentation Editor | `.pptx`, `.ppt` |

**示例**：
```json
"EditorsSupport": ["word", "cell", "slide"]  // 支持所有类型
```

### Q6: 插件中使用本地图片资源？

```javascript
// ✅ 正确：使用相对路径
var pluginUrl = window.Asc.plugin.baseUrl || '';
var imagePath = pluginUrl + '/resources/watermark.png';

// ❌ 错误：使用绝对路径
var imagePath = '/Users/azo/Work-EMPOWER/watermark_plugin/resources/watermark.png';
```

---

## 快速参考

### 完整安装流程（一键命令）

```bash
# 1. 查找容器名
CONTAINER_NAME=$(docker ps --filter "ancestor=onlyoffice/documentserver" --format "{{.Names}}" | head -1)

# 2. 获取插件 GUID（从 config.json 中提取）
PLUGIN_GUID=$(cat ~/Work-EMPOWER/watermark_plugin/config.json | grep '"guid"' | grep -o '{[^}]\+}')

# 3. 复制插件
docker cp \
  ~/Work-EMPOWER/watermark_plugin \
  ${CONTAINER_NAME}:/var/www/onlyoffice/documentserver/sdkjs-plugins/${PLUGIN_GUID}

# 4. 重启容器
docker restart ${CONTAINER_NAME}
```

### 常用路径

| 项目 | 路径 |
|------|------|
| 插件安装目录 | `/var/www/onlyoffice/documentserver/sdkjs-plugins/` |
| SDK 基础文件 | `/var/www/onlyoffice/documentserver/sdkjs-plugins/pluginBase.js` |
| SDK v1 目录 | `/var/www/onlyoffice/documentserver/sdkjs-plugins/v1/` |

---

## 参考资料

- [OnlyOffice 插件开发官方文档](https://api.onlyoffice.com/docbuilder/basic-how-to-work-with-plugins)
- [OnlyOffice 插件 API 参考](https://api.onlyoffice.com/plugin/)
- [OnlyOffice 插件示例（GitHub）](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/plugins)

---

**文档版本**: v1.0
**最后更新**: 2026-03-25
**作者**: Claude Code
**适用版本**: OnlyOffice Document Server（Docker）
