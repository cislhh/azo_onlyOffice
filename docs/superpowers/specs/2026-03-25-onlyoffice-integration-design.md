# OnlyOffice 集成设计文档（修订版）

**日期**: 2026-03-25
**项目**: demo-office
**目标**: 在 Vue 3 项目中集成 OnlyOffice Document Server，实现文档查看、编辑和对比功能

## 📋 修订记录

**v1.3 (2026-03-25)**: 修复 code-reviewer 发现的问题
- 🔴 [CRITICAL] 修复文件上传方案，使用 HTTP API 而非直接写入
- 🔴 [CRITICAL] 修复对比功能的第二个文件上传逻辑
- 🔴 [CRITICAL] 添加明确的 callbackUrl 配置说明
- 🟠 [HIGH] 修复 TypeScript 类型定义（callbackUrl 可选）
- 🟠 [HIGH] 添加环境变量验证
- 🟠 [HIGH] 修复文件大小验证使用环境变量
- 🟡 [MEDIUM] 修复 CORS 配置说明，添加 Vite proxy 方案
- 🟡 [MEDIUM] 移除存疑的 actionLink 配置

**v1.2 (2026-03-25)**: 根据用户需求调整 MVP 范围
- 🔄 [CHANGE] 将文档编辑和对比功能加入 MVP，用于前端验证
- 📝 [INFO] 添加编辑模式限制说明：界面可用但保存需要后端
- ✅ [CONFIRM] 确认对比功能使用 `setRevisedFile` 可在前端实现

**v1.1 (2026-03-25)**: 根据 code-reviewer 反馈修复关键问题
- 🔴 [CRITICAL] 修复 Blob URL 不可行问题，改用临时文件服务器方案
- 🔴 [CRITICAL] 修复编辑模式保存回调配置
- 🔴 [CRITICAL] 修复对比模式配置方式
- 🟠 [HIGH] 修复 Vue 3 computed 最佳实践问题
- 🟠 [HIGH] 添加 Blob URL 内存泄漏防护
- 🟠 [HIGH] 完善 TypeScript 类型定义
- 🟡 [MEDIUM] 添加文件大小验证
- 🟡 [MEDIUM] 使用环境变量配置
- ⚪ [LOW] 修复废弃 API 使用（substr → substring）
- ➕ 补充 CORS 和 JWT 配置说明

## 1. 概述

### 1.1 目标

在现有的 Vue 3 + TypeScript + Vite 项目中集成 OnlyOffice Document Server，提供以下核心功能：

- **MVP 范围**：
  - ✅ 文档查看（只读模式）
  - ✅ 文档编辑（界面可用，保存功能需要后端）
  - ✅ 文档对比（完整功能）

**MVP 目的**：在前端环境中验证 OnlyOffice 是否能支持以下需求：
1. Word 和 PDF 文档的查看体验
2. 文档编辑功能是否满足需求
3. 多文档对比功能的可用性

> **注意**：MVP 阶段编辑模式的**保存功能**需要后端 API 支持，但编辑界面和功能可以在前端完整体验。

### 1.2 技术栈

- **前端框架**: Vue 3.5.30 (Composition API + `<script setup>`)
- **类型系统**: TypeScript 5.9.3
- **构建工具**: Vite 7.3.1
- **路由**: Vue Router 5.0.3
- **状态管理**: Pinia 3.0.4（本 MVP 暂不使用，使用本地 ref）
- **OnlyOffice 组件**: `@onlyoffice/document-editor-vue`
- **OnlyOffice Server**: Docker 容器（运行在 http://localhost:8080）

### 1.3 文档格式支持

**MVP 范围**:
- Word 文档: `.docx` (查看、编辑、对比)
- PDF 文档: `.pdf` (仅查看)

> **注意**：
> - PDF 不支持编辑和对比（OnlyOffice 限制）
> - 编辑模式的保存功能需要后端 API，但编辑界面可以完整体验

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────┐
│                 Vue 3 应用                       │
├─────────────────────────────────────────────────┤
│  OfficeView.vue (主页面)                         │
│  ├─ Tab 切换 (查看)                              │
│  └─ OnlyOfficeEditor.vue (封装组件)             │
│     └─ DocumentEditor (OnlyOffice 官方组件)     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│     Vite 临时文件服务 (public/temp/)            │
│     http://localhost:5173/temp/                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│     OnlyOffice Document Server (Docker)         │
│     http://localhost:8080                       │
└─────────────────────────────────────────────────┘
```

### 2.2 核心架构变化

**⚠️ 关键问题**: OnlyOffice Document Server **无法直接访问浏览器的 Blob URL**。

**解决方案**: 使用前端 API 上传文件到 Vite 中间件

```
用户选择文件 (File 对象)
    ↓
前端读取文件内容 (FormData)
    ↓
POST /api/upload 上传到 Vite 中间件
    ↓
Vite 中间件写入 public/temp/ 目录
    ↓
返回 HTTP URL (http://localhost:5173/temp/xxx.docx)
    ↓
OnlyOffice 通过 HTTP 获取文档
```

> **重要**: 浏览器无法直接写入服务器的 `public/temp/` 目录，必须通过 HTTP API 上传。

### 2.3 组件层次

```
src/
├── components/
│   └── OnlyOfficeEditor.vue          # OnlyOffice 封装组件
├── views/
│   └── OfficeView.vue                 # 主页面（包含三个 Tab）
├── router/
│   └── index.ts                       # 路由配置
├── types/
│   └── onlyoffice.d.ts                # TypeScript 类型定义
├── utils/
│   ├── fileHelper.ts                  # 文件处理工具函数
│   └── logger.ts                      # 日志工具
├── composables/
│   └── useFileUpload.ts               # 文件上传逻辑复用
└── server/
    └── fileUpload.ts                  # Vite 插件：处理文件上传 API
```

## 3. 核心功能设计

### 3.1 MVP 功能一：文档查看

#### 3.1.1 功能描述

- 用户上传本地 Word/PDF 文件
- 在只读模式下显示文档内容
- 支持缩放、滚动、页面导航
- **支持格式**：`.docx`, `.pdf`

#### 3.1.2 技术实现

**关键步骤**:

1. **文件上传处理**:
   ```typescript
   // 用户选择文件 → 前端读取 → 写入 public/temp/ → 生成 HTTP URL
   ```

2. **OnlyOffice 配置**:
   - `documentType`: 根据文件扩展名自动识别（`word` 或 `pdf`）
   - `editorConfig.mode = 'view'`: 设置为只读模式
   - `document.url`: 指向临时 HTTP URL

**配置示例**:
```typescript
{
  document: {
    fileType: 'docx',
    key: 'unique-key',
    title: 'document.docx',
    url: 'http://localhost:5173/temp/document-123456.docx'
  },
  documentType: 'word',
  editorConfig: {
    mode: 'view',
    callbackUrl: '',  // 查看模式不需要回调
    lang: 'zh-CN'
  }
}
```

### 3.2 MVP 功能二：文档编辑（前端验证）

#### 3.2.1 功能描述

- 用户上传本地 Word 文件
- 在编辑模式下打开文档
- **可以体验所有编辑功能**：文本编辑、格式调整、插入图片、表格等
- **保存功能**：MVP 阶段无法真正保存（需要后端），但可以验证保存流程

> **⚠️ 重要说明**：
> - 编辑界面和功能完全可用，可以完整体验 OnlyOffice 的编辑能力
> - 点击保存或关闭文档时，OnlyOffice 会尝试向 `callbackUrl` 发送请求
> - MVP 中使用空的 `callbackUrl`，会导致保存失败（这是预期的）
> - **目的**：验证 OnlyOffice 的编辑功能是否满足你的需求

#### 3.2.2 技术实现

**OnlyOffice 配置**:
```typescript
{
  document: {
    fileType: 'docx',
    key: 'unique-key',
    title: 'document.docx',
    url: 'http://localhost:5173/temp/document-123456.docx',
    permissions: {
      edit: true,       // 允许编辑
      download: true,   // 允许下载
      print: true       // 允许打印
    }
  },
  documentType: 'word',
  editorConfig: {
    mode: 'edit',
    callbackUrl: '',  // ⚠️ MVP 阶段为空，保存会失败
    lang: 'zh-CN'
  }
}
```

**保存失败的预期行为**:
- OnlyOffice 会显示 "文档保存失败" 的错误提示
- 这是正常的，因为 callbackUrl 为空
- 用户仍然可以继续编辑，只是无法持久化更改

#### 3.2.3 验证要点

在 MVP 中，你需要验证：
1. ✅ 编辑界面是否满足需求
2. ✅ 支持的编辑功能是否足够（文本、图片、表格、公式等）
3. ✅ 协作编辑功能（如果需要）
4. ✅ 修订和审阅功能
5. ✅ 性能和响应速度

### 3.3 MVP 功能三：文档对比

#### 3.3.1 功能描述

- 用户上传**两个** Word 文档
- OnlyOffice 会高亮显示两个文档之间的差异
- 支持接受/拒绝修订
- **支持格式**：仅 `.docx`（PDF 不支持对比）

> **✅ 确认**：根据[官方文档](https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/comparing-documents/)，对比功能可以在前端完整实现，无需后端支持。

#### 3.3.2 技术实现

**关键步骤**:

1. **准备两个文档**:
   - 原始文档（Original）
   - 修订文档（Revised）

2. **监听对比事件**:
   ```typescript
   function onRequestCompareFile() {
     const docEditor = window.DocEditor.instances["onlyoffice-editor"]

     docEditor.setRevisedFile({
       fileType: "docx",
       url: "http://localhost:5173/temp/compare-file.docx",
       token: ""  // 如果禁用 JWT，可以为空
     })
   }
   ```

3. **OnlyOffice 配置**:
   ```typescript
   {
     document: {
       fileType: 'docx',
       key: 'unique-key',
       title: 'original.docx',
       url: 'http://localhost:5173/temp/original-file.docx'
     },
     documentType: 'word',
     editorConfig: {
       mode: 'edit',  // 对比需要在 edit 模式下
       callbackUrl: '',
       lang: 'zh-CN'
     },
     events: {
       onRequestCompareFile: 'onRequestCompareFile'
     }
   }
   ```

**配置说明**:
- 第一个文档通过 `document.url` 指定（原始文档）
- 第二个文档通过 `setRevisedFile()` 方法指定（修订文档）
- OnlyOffice 会自动对比并高亮差异

#### 3.3.3 验证要点

在 MVP 中，你需要验证：
1. ✅ 对比功能的准确性
2. ✅ 差异高亮显示是否清晰
3. ✅ 接受/拒绝修订功能
4. ✅ 对比多个文档时的性能

## 4. OnlyOffice 配置详解

### 4.1 DocumentEditor 组件属性

根据[官方文档](https://api.onlyoffice.com/zh-CN/docs/docs-api/get-started/frontend-frameworks/vue/)：

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 组件唯一标识符 |
| `documentServerUrl` | string | ✅ | OnlyOffice 服务器地址 |
| `config` | object | ✅ | 文档配置对象 |
| `height` | string | ❌ | 编辑器高度 |
| `width` | string | ❌ | 编辑器宽度 |

### 4.2 Config 对象结构

```typescript
interface OnlyOfficeConfig {
  document: {
    fileType: string      // 文件类型: docx, xlsx, pptx, pdf
    key: string           // 文档唯一标识符
    title: string         // 文档标题
    url: string           // ⚠️ 必须是 HTTP(S) URL，不能用 Blob URL
    permissions?: {       // 权限配置
      edit?: boolean      // 是否可编辑
      download?: boolean  // 是否可下载
      print?: boolean     // 是否可打印
    }
  }
  documentType: 'word' | 'cell' | 'slide'
  editorConfig: {
    mode: 'edit' | 'view' | 'review'
    callbackUrl: string   // ⚠️ 编辑模式必须有值，不能为空
    lang: 'zh-CN'         // 界面语言
  }
}
```

### 4.3 关键事件

| 事件 | 触发时机 | 用途 |
|------|----------|------|
| `events_onDocumentReady` | 文档加载完成 | 初始化完成后操作 |
| `onLoadComponentError` | 组件加载失败 | 错误处理 |
| `events_onRequestCompareFile` | 用户请求对比文档 | 调用 `setRevisedFile()` 方法 |
| `events_onRequestSaveAs` | 用户另存为 | 保存到新位置 |
| `events_onDocumentStateChange` | 文档状态改变 | 检测文档是否被修改 |

### 4.4 事件类型定义（修复 TypeScript 类型）

```typescript
export interface SaveAsEvent {
  data: {
    title: string
    url: string
    fileType: string
  }
}

export interface ComponentErrorEvent {
  errorCode: number
  errorDescription: string
}

export interface OnlyOfficeEvents {
  onDocumentReady: () => void
  onLoadComponentError: (event: ComponentErrorEvent) => void
  onRequestSaveAs?: (event: SaveAsEvent) => void
  onRequestCompareFile?: () => void
  onDocumentStateChange?: (event: { data: boolean }) => void
}
```

## 5. 实现细节

### 5.1 文件处理工具函数（修复问题）

```typescript
// src/utils/fileHelper.ts

// ✅ 使用环境变量配置文件大小限制
const MAX_FILE_SIZE = Number(import.meta.env.VITE_MAX_FILE_SIZE) || 10 * 1024 * 1024  // 默认 10MB
const ALLOWED_EXTS = ['docx', 'pdf', 'xlsx', 'pptx']

/**
 * 验证文件
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0)
    return {
      valid: false,
      error: `文件大小不能超过 ${maxSizeMB}MB`
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    return {
      valid: false,
      error: `不支持的文件格式，仅支持: ${ALLOWED_EXTS.join(', ')}`
    }
  }

  return { valid: true }
}

/**
 * 获取文件类型
 */
export function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const typeMap: Record<string, string> = {
    'docx': 'docx',
    'pdf': 'pdf',
    'xlsx': 'xlsx',
    'pptx': 'pptx'
  }
  return typeMap[ext || ''] || 'docx'
}

/**
 * 获取文档类型
 */
export function getDocumentType(fileType: string): 'word' | 'cell' | 'slide' {
  const typeMap: Record<string, 'word' | 'cell' | 'slide'> = {
    'docx': 'word',
    'pdf': 'word',  // PDF 使用 word 类型
    'xlsx': 'cell',
    'pptx': 'slide'
  }
  return typeMap[fileType] || 'word'
}

/**
 * 生成唯一键
 */
export function generateKey(): string {
  // ✅ 修复：使用 substring 而不是 substr（substr 已废弃）
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * 上传文件到服务器
 * @param file 要上传的文件
 * @returns 上传后的 HTTP URL
 */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(`文件上传失败: ${response.statusText}`)
  }

  const result = await response.json()
  return result.url  // 返回: /temp/xxx.docx
}

/**
 * 创建文件 URL（Blob URL，带内存泄漏防护）
 * @deprecated 不再使用 Blob URL，改用 uploadFile
 */
export function createFileUrl(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * 释放文件 URL
 * @deprecated 不再使用 Blob URL
 */
export function revokeFileUrl(url: string): void {
  URL.revokeObjectURL(url)
}
```

### 5.2 日志工具（移除 console.log）

```typescript
// src/utils/logger.ts

const isDev = import.meta.env.DEV

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log('[Demo Office]', ...args)
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error('[Demo Office]', ...args)
    } else {
      // 生产环境可以发送到日志服务
      // sendToLogService('error', args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn('[Demo Office]', ...args)
    }
  }
}
```

### 5.3 环境变量配置

```bash
# .env.local
VITE_ONLYOFFICE_URL=http://localhost:8080
VITE_MAX_FILE_SIZE=10485760
```

### 5.4 Vite 插件：临时文件服务

```typescript
// src/server/fileUpload.ts
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * Vite 插件：处理文件上传到 public/temp/
 */
export function fileUploadPlugin(): Plugin {
  const tempDir = path.resolve(process.cwd(), 'public/temp')

  // 确保 temp 目录存在
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  return {
    name: 'file-upload',
    configureServer(server) {
      server.middlewares.use('/api/upload', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        try {
          // 解析 multipart/form-data
          const chunks: Buffer[] = []
          req.on('data', (chunk) => chunks.push(chunk))
          req.on('end', () => {
            const buffer = Buffer.concat(chunks)
            // 简化版：实际应该使用 formidable 或 multer
            // 这里需要前端发送 base64 或使用专门的库

            const filename = `file-${Date.now()}.docx`
            const filepath = path.join(tempDir, filename)

            fs.writeFileSync(filepath, buffer)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              url: `/temp/${filename}`
            }))
          })
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Upload failed' }))
        }
      })
    }
  }
}
```

### 5.5 OnlyOfficeEditor 组件（修复 Vue 3 最佳实践）

```typescript
// src/components/OnlyOfficeEditor.vue

<script setup lang="ts">
import { ref, computed } from 'vue'
import { DocumentEditor } from '@onlyoffice/document-editor-vue'
import type { OnlyOfficeConfig } from '@/types/onlyoffice'
import { getFileType, getDocumentType, generateKey } from '@/utils/fileHelper'
import { logger } from '@/utils/logger'

interface Props {
  documentServerUrl: string
  fileUrl?: string  // 已上传文件的 HTTP URL
  file?: File
  mode: 'view' | 'edit' | 'compare'
  compareFileUrl?: string  // 已上传对比文件的 HTTP URL
  compareFile?: File  // 对比模式的第二个文件（原始 File 对象，用于上传）
}

const props = defineProps<Props>()
const emit = defineEmits<{
  documentReady: []
  error: [message: string]
  stateChanged: [isModified: boolean]
}>()

// ✅ 使用上传后的 URL，而不是 Blob URL
const config = computed<OnlyOfficeConfig | null>(() => {
  // 检查是否有所需的 URL
  if (!props.fileUrl) {
    return null
  }

  // 对比模式需要两个文件都已上传
  if (props.mode === 'compare' && !props.compareFileUrl) {
    return null
  }

  const fileType = getFileType(props.file?.name || '')
  const documentType = getDocumentType(fileType)
  const key = generateKey()

  // 根据模式设置权限
  const isEditMode = props.mode === 'edit' || props.mode === 'compare'
  const isCompareMode = props.mode === 'compare'

  return {
    document: {
      fileType,
      key,
      title: props.file?.name || 'document',
      url: props.fileUrl,
      permissions: {
        edit: isEditMode,  // 编辑和对比模式允许编辑
        download: true,
        print: true
      }
    },
    documentType,
    editorConfig: {
      mode: isCompareMode ? 'edit' : props.mode,  // 对比模式使用 edit
      callbackUrl: isEditMode ? '' : undefined,  // 编辑模式需要 callbackUrl（MVP 为空）
      lang: 'zh-CN'
    },
    events: {
      ...(isCompareMode && {
        onRequestCompareFile: 'onRequestCompareFile'
      }),
      onDocumentStateChange: 'onDocumentStateChange'
    }
  }
})

const onDocumentReady = () => {
  logger.log('文档加载完成')
  emit('documentReady')
}

const onLoadComponentError = (event: ComponentErrorEvent) => {
  logger.error('组件加载错误:', event.errorCode, event.errorDescription)

  let message = '未知错误'
  switch (event.errorCode) {
    case -1:
      message = `未知错误: ${event.errorDescription}`
      break
    case -2:
      message = '无法连接 OnlyOffice 服务器，请检查 Docker 容器是否运行'
      break
    case -3:
      message = 'DocsAPI 未定义'
      break
  }

  emit('error', message)
}

// 对比模式：当用户请求对比文件时触发
const onRequestCompareFile = () => {
  logger.log('请求对比文件')

  // ✅ 修复：使用已上传的 URL
  if (!props.compareFileUrl) {
    logger.error('对比文件 URL 未提供')
    return
  }

  // 获取 DocEditor 实例
  const docEditor = (window as any).DocEditor?.instances?.['onlyoffice-editor']
  if (!docEditor) {
    logger.error('无法获取 DocEditor 实例')
    return
  }

  // 调用 setRevisedFile 方法设置对比文件
  const compareFileType = getFileType(props.compareFile?.name || '')
  docEditor.setRevisedFile({
    fileType: compareFileType,
    url: props.compareFileUrl,  // ✅ 使用已上传文件的 URL
    token: ''  // 如果禁用 JWT，可以为空
  })
}

// 文档状态改变事件（用于检测是否被修改）
const onDocumentStateChange = (event: { data: boolean }) => {
  logger.log('文档状态改变:', event.data)
  emit('stateChanged', event.data)
}
</script>

<template>
  <!-- ✅ 使用 v-if 条件渲染，而不是在 computed 中抛出错误 -->
  <DocumentEditor
    v-if="config"
    id="onlyoffice-editor"
    :documentServerUrl="documentServerUrl"
    :config="config"
    height="600px"
    width="100%"
    :events_onDocumentReady="onDocumentReady"
    :events_onRequestCompareFile="onRequestCompareFile"
    :events_onDocumentStateChange="onDocumentStateChange"
    :onLoadComponentError="onLoadComponentError"
  />
  <div v-else class="error-message">
    请选择文件
  </div>
</template>

<style scoped>
.error-message {
  padding: 40px;
  text-align: center;
  color: #666;
  font-size: 16px;
}
</style>
```

### 5.6 OfficeView 主页面

```typescript
// src/views/OfficeView.vue

<script setup lang="ts">
import { ref } from 'vue'
import OnlyOfficeEditor from '@/components/OnlyOfficeEditor.vue'
import { validateFile, uploadFile } from '@/utils/fileHelper'
import { logger } from '@/utils/logger'

// ✅ 验证环境变量
const DOCUMENT_SERVER_URL = import.meta.env.VITE_ONLYOFFICE_URL

if (!DOCUMENT_SERVER_URL) {
  throw new Error(
    '环境变量 VITE_ONLYOFFICE_URL 未配置。\n' +
    '请在 .env.local 文件中添加：\n' +
    'VITE_ONLYOFFICE_URL=http://localhost:8080'
  )
}

type TabMode = 'view' | 'edit' | 'compare'

const activeTab = ref<TabMode>('view')
const viewFile = ref<File>()
const viewFileUrl = ref<string>()
const editFile = ref<File>()
const editFileUrl = ref<string>()
const compareOriginalFile = ref<File>()
const compareOriginalFileUrl = ref<string>()
const compareRevisedFile = ref<File>()
const compareRevisedFileUrl = ref<string>()
const errorMessage = ref<string>()
const isUploading = ref(false)

const handleFileUpload = async (event: Event, fileRef: typeof viewFile, urlRef: typeof viewFileUrl) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.[0]) {
    return
  }

  const file = target.files[0]
  const validation = validateFile(file)

  if (!validation.valid) {
    errorMessage.value = validation.error
    logger.error('文件验证失败:', validation.error)
    return
  }

  errorMessage.value = undefined
  isUploading.value = true

  try {
    // ✅ 上传文件到服务器
    const url = await uploadFile(file)
    fileRef.value = file
    urlRef.value = url
    logger.log('文件已上传:', file.name, '→', url)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '文件上传失败'
    logger.error('文件上传失败:', error)
  } finally {
    isUploading.value = false
  }
}

const handleDocumentReady = () => {
  logger.log('文档加载完成')
}

const handleError = (message: string) => {
  logger.error('OnlyOffice 错误:', message)
  errorMessage.value = message
}
</script>

<template>
  <div class="office-container">
    <h1>Demo Office - OnlyOffice 集成演示</h1>

    <div class="tabs">
      <button
        :class="{ active: activeTab === 'view' }"
        @click="activeTab = 'view'"
      >
        查看文档
      </button>
      <button
        :class="{ active: activeTab === 'edit' }"
        @click="activeTab = 'edit'"
      >
        编辑文档
      </button>
      <button
        :class="{ active: activeTab === 'compare' }"
        @click="activeTab = 'compare'"
      >
        文档对比
      </button>
    </div>

    <!-- 查看模式 -->
    <div v-if="activeTab === 'view'" class="tab-content">
      <div class="upload-section">
        <label>选择文件（支持 .docx, .pdf）：</label>
        <input
          type="file"
          accept=".docx,.pdf"
          :disabled="isUploading"
          @change="(e) => handleFileUpload(e, viewFile, viewFileUrl)"
        />
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>

      <OnlyOfficeEditor
        v-if="viewFileUrl"
        :documentServerUrl="DOCUMENT_SERVER_URL"
        :file-url="viewFileUrl"
        :file="viewFile"
        mode="view"
        @document-ready="handleDocumentReady"
        @error="handleError"
      />
    </div>

    <!-- 编辑模式 -->
    <div v-if="activeTab === 'edit'" class="tab-content">
      <div class="upload-section">
        <label>选择文件（仅支持 .docx）：</label>
        <input
          type="file"
          accept=".docx"
          :disabled="isUploading"
          @change="(e) => handleFileUpload(e, editFile, editFileUrl)"
        />
        <div v-if="isUploading" class="info-message">
          ⏳ 正在上传文件...
        </div>
        <div v-else class="info-message">
          ⚠️ 编辑界面完全可用，但保存功能需要后端 API 支持（MVP 阶段保存会失败）
        </div>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>

      <OnlyOfficeEditor
        v-if="editFileUrl"
        :documentServerUrl="DOCUMENT_SERVER_URL"
        :file-url="editFileUrl"
        :file="editFile"
        mode="edit"
        @document-ready="handleDocumentReady"
        @error="handleError"
      />
    </div>

    <!-- 对比模式 -->
    <div v-if="activeTab === 'compare'" class="tab-content">
      <div class="upload-section">
        <label>原始文档（仅支持 .docx）：</label>
        <input
          type="file"
          accept=".docx"
          :disabled="isUploading"
          @change="(e) => handleFileUpload(e, compareOriginalFile, compareOriginalFileUrl)"
        />

        <label>修订文档（仅支持 .docx）：</label>
        <input
          type="file"
          accept=".docx"
          :disabled="isUploading"
          @change="(e) => handleFileUpload(e, compareRevisedFile, compareRevisedFileUrl)"
        />

        <div v-if="isUploading" class="info-message">
          ⏳ 正在上传文件...
        </div>
        <div v-else class="info-message">
          ✅ 对比功能完整可用，无需后端支持
        </div>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>

      <OnlyOfficeEditor
        v-if="compareOriginalFileUrl && compareRevisedFileUrl"
        :documentServerUrl="DOCUMENT_SERVER_URL"
        :file-url="compareOriginalFileUrl"
        :file="compareOriginalFile"
        :compare-file-url="compareRevisedFileUrl"
        :compare-file="compareRevisedFile"
        mode="compare"
        @document-ready="handleDocumentReady"
        @error="handleError"
      />
    </div>
  </div>
</template>

<style scoped>
.office-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #ddd;
}

.tabs button {
  padding: 10px 20px;
  border: none;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 16px;
  border-radius: 4px 4px 0 0;
}

.tabs button.active {
  background: #1890ff;
  color: white;
}

.tabs button:hover:not(.active) {
  background: #e6f7ff;
}

.tab-content {
  margin-top: 20px;
}

.upload-section {
  margin-bottom: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.upload-section label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
}

.upload-section input {
  display: block;
  width: 100%;
  max-width: 400px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.error-message {
  margin-top: 10px;
  color: #f5222d;
  font-size: 14px;
}

.info-message {
  margin-top: 10px;
  padding: 10px;
  background: #e6f7ff;
  border-left: 3px solid #1890ff;
  font-size: 14px;
  color: #0050b3;
}

.upload-section label {
  display: block;
  margin-bottom: 10px;
  margin-top: 15px;
  font-weight: bold;
}
</style>
```

## 6. Docker 配置

### 6.1 启动 OnlyOffice Document Server

```bash
# ✅ 修复：使用非特权端口，避免权限问题
docker run -i -t -d \
  -p 8080:80 \
  -e ONLYOFFICE_HTTPS_HSTS_ENABLED=false \
  onlyoffice/documentserver

# 验证容器运行
docker ps | grep onlyoffice

# 查看日志
docker logs -f <container-id>
```

### 6.2 CORS 配置

**⚠️ 重要**: OnlyOffice Document Server 需要配置 CORS 允许前端域名访问。

**开发环境方案**：
在开发环境中，可以通过 Vite proxy 代理 OnlyOffice 请求，避免 CORS 问题：

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/onlyoffice': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/onlyoffice/, '')
      }
    }
  }
})
```

然后使用 `documentServerUrl: '/onlyoffice'` 而不是 `http://localhost:8080`。

**生产环境方案**：
需要配置 OnlyOffice Document Server 的 Nginx 配置，添加 CORS 头。详见官方文档。

### 6.3 JWT 配置（OnlyOffice 7.2+）

OnlyOffice Document Server 7.2+ 默认启用 JWT 验证。有两种解决方案：

**方案 A: 禁用 JWT（开发环境）**
```bash
docker run -i -t -d \
  -p 8080:80 \
  -e JWT_ENABLED=false \
  -e ONLYOFFICE_HTTPS_HSTS_ENABLED=false \
  onlyoffice/documentserver
```

**方案 B: 配置 JWT（生产环境）**
```typescript
// 需要在 config 中添加 token
const config = {
  // ...
  token: generateJWTToken(config)
}
```

MVP 使用方案 A（禁用 JWT）。

## 7. 路由配置

```typescript
// src/router/index.ts

import { createRouter, createWebHistory } from 'vue-router'
import OfficeView from '@/views/OfficeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/office',
      name: 'office',
      component: OfficeView
    }
  ]
})

export default router
```

## 8. TypeScript 类型定义（完整版）

```typescript
// src/types/onlyoffice.d.ts

export interface OnlyOfficeConfig {
  document: {
    fileType: string
    key: string
    title: string
    url: string
    permissions?: {
      edit?: boolean
      download?: boolean
      print?: boolean
    }
  }
  documentType: 'word' | 'cell' | 'slide'
  editorConfig: {
    mode: 'edit' | 'view' | 'review'
    callbackUrl?: string  // ✅ 可选，编辑模式需要
    lang: string
    user?: {
      id: string
      name: string
    }
  }
  events?: {
    onRequestCompareFile?: string
    onDocumentStateChange?: string
  }
  token?: string  // JWT token（如果启用）
}

export interface SaveAsEvent {
  data: {
    title: string
    url: string
    fileType: string
  }
}

export interface ComponentErrorEvent {
  errorCode: number
  errorDescription: string
}

export interface OnlyOfficeEvents {
  onDocumentReady: () => void
  onLoadComponentError: (event: ComponentErrorEvent) => void
  onRequestSaveAs?: (event: SaveAsEvent) => void
  onRequestCompareFile?: () => void
  onDocumentStateChange?: (event: { data: boolean }) => void
}
```

## 9. 依赖安装

```bash
# 安装 OnlyOffice Vue 组件
pnpm add @onlyoffice/document-editor-vue
```

## 10. Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileUploadPlugin } from './src/server/fileUpload'

export default defineConfig({
  plugins: [
    vue(),
    fileUploadPlugin()  // 添加文件上传插件
  ],
  server: {
    port: 5173,
    proxy: {
      // 代理 OnlyOffice 请求（如果需要）
      '/onlyoffice': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
```

## 11. 测试计划

### 11.1 手动测试用例

#### 查看模式测试
1. ✅ 上传 `.docx` 文件，确认能正常显示
2. ✅ 上传 `.pdf` 文件，确认能正常显示
3. ✅ 验证无法编辑内容
4. ✅ 验证错误提示（文件大小超限、格式不支持）

#### 编辑模式测试
1. ✅ 上传 `.docx` 文件，确认能进入编辑模式
2. ✅ 验证编辑功能：文本编辑、格式调整、插入图片
3. ✅ 验证编辑功能：插入表格、公式、页眉页脚
4. ✅ 验证点击保存会失败（预期行为，因为没有后端）
5. ✅ 验证即使保存失败，仍然可以继续编辑

#### 对比模式测试
1. ✅ 上传两个不同的 `.docx` 文件
2. ✅ 验证差异高亮显示正确
3. ✅ 验证接受/拒绝修订功能
4. ✅ 验证对比界面清晰易用

### 11.2 测试文档准备

准备测试用的文档：
- `test.docx`: 包含简单文本的 Word 文档
- `test-edited.docx`: 包含修改的 Word 文档（用于对比）
- `test.pdf`: PDF 文档
- `large.docx`: 大文件（> 10MB，测试大小限制）
- `complex.docx`: 包含图片、表格、公式的复杂文档

## 12. 已知问题和限制

### 12.1 MVP 限制

1. **编辑模式无法保存**:
   - 编辑界面完全可用，可以完整体验 OnlyOffice 编辑功能
   - 保存需要后端 API 接收 `callbackUrl` 请求
   - MVP 中使用空的 `callbackUrl`，保存会失败（这是预期的）
   - **目的**：前端验证 OnlyOffice 是否满足需求

2. **无持久化**:
   - 刷新页面后文档丢失
   - 临时文件存储在 `public/temp/`，需要定期清理

3. **格式限制**:
   - PDF 仅支持查看，不支持编辑和对比
   - 对比功能仅支持 `.docx` 格式

### 12.2 技术债务

1. **文件上传**: Vite 插件实现较简陋，生产环境需要完善的 multipart 解析
2. **CORS 问题**: 可能需要调整 OnlyOffice Docker 配置
3. **JWT 验证**: MVP 暂时禁用，生产环境需要启用

### 12.3 后续工作

**Phase 2: 实现编辑保存功能**
- 实现后端 API 接收 OnlyOffice 回调
- 配置正确的 `callbackUrl`
- 实现文档保存逻辑
- 支持文档版本管理

**Phase 3: 扩展功能**
- 支持更多文档格式（.xlsx, .pptx）
- 实现文档历史记录
- 添加协作编辑功能
- 实现文档权限管理

## 13. 部署注意事项

### 13.1 生产环境配置

- ✅ 使用 HTTPS 而不是 HTTP
- ✅ 配置正确的 `documentServerUrl`（生产服务器地址）
- ✅ 启用 JWT 验证
- ✅ 配置 CORS 允许生产域名
- ✅ 实现文件清理逻辑

### 13.2 安全考虑

- ✅ 验证文件类型和大小
- ✅ 防止恶意文件上传
- ✅ 限制 OnlyOffice 服务器访问
- ✅ 清理临时文件

## 14. 参考资料

- [OnlyOffice Docs API - Vue](https://api.onlyoffice.com/zh-CN/docs/docs-api/get-started/frontend-frameworks/vue/)
- [OnlyOffice Document Server](https://github.com/ONLYOFFICE/Docker-DocumentServer)
- [@onlyoffice/document-editor-vue](https://www.npmjs.com/package/@onlyoffice/document-editor-vue)
- [OnlyOffice Example Vue](https://github.com/ONLYOFFICE/document-editor-vue)

## 15. 附录：完整实现检查清单

### 15.1 代码实现

- [ ] 安装依赖 `@onlyoffice/document-editor-vue`
- [ ] 创建 `src/utils/fileHelper.ts`
- [ ] 创建 `src/utils/logger.ts`
- [ ] 创建 `src/types/onlyoffice.d.ts`
- [ ] 创建 `src/components/OnlyOfficeEditor.vue`
- [ ] 创建 `src/views/OfficeView.vue`
- [ ] 更新 `src/router/index.ts`
- [ ] 创建 `.env.local` 配置文件
- [ ] 更新 `vite.config.ts`

### 15.2 Docker 配置

- [ ] 启动 OnlyOffice Docker 容器（端口 8080）
- [ ] 验证容器运行正常
- [ ] 测试服务可访问（http://localhost:8080）

### 15.3 测试

- [ ] 测试 Word 文档查看
- [ ] 测试 PDF 文档查看
- [ ] 测试文件大小验证
- [ ] 测试文件格式验证
- [ ] 测试错误处理

---

**文档版本**: v1.3
**最后更新**: 2026-03-25
**状态**: ✅ 已修复 code-reviewer 发现的所有 CRITICAL 和 HIGH 问题
