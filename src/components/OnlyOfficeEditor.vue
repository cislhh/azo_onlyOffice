<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DocumentEditor } from '@onlyoffice/document-editor-vue'
import type { OnlyOfficeConfig, ComponentErrorEvent, OnlyOfficeUiTheme } from '@/types/onlyoffice'
import { getFileType, getDocumentType, generateKey, uploadFile } from '@/utils/fileHelper'
import { logger } from '@/utils/logger'

interface Props {
  documentServerUrl: string
  fileUrl?: string
  file?: File
  mode: 'view' | 'edit' | 'compare'
  uiTheme?: OnlyOfficeUiTheme
  editorId?: string
  revisedFileUrl?: string
  revisedFile?: File
  isPublicUrl?: boolean
}

interface CompareRequestPayload {
  c: 'compare'
  fileType: string
  key: string
  title: string
  url: string
}

interface DocEditorInstance {
  setRequestedDocument?: (payload: CompareRequestPayload) => void
  setRevisedFile?: (payload: Omit<CompareRequestPayload, 'c'>) => void
}

const props = defineProps<Props>()
const emit = defineEmits<{
  documentReady: []
  error: [message: string]
  stateChanged: [isModified: boolean]
}>()

const fileAccessBaseUrl = import.meta.env.VITE_FILE_ACCESS_BASE_URL as string | undefined
const fileAccessHost = import.meta.env.VITE_FILE_ACCESS_HOST as string | undefined
const toolbarPluginConfigUrlFromEnv = import.meta.env.VITE_ONLYOFFICE_TOOLBAR_PLUGIN_URL as string | undefined
const useRemoteToolbarPlugin = import.meta.env.VITE_ONLYOFFICE_USE_REMOTE_TOOLBAR_PLUGIN === 'true'
const toolbarPluginVersion = import.meta.env.VITE_ONLYOFFICE_TOOLBAR_PLUGIN_VERSION || '20260327.11'
const toolbarPluginRequestNonce = Date.now().toString(36)
const toolbarPluginGuid = 'asc.{54F10D3B-BF9E-4D03-9E3D-A2EBB69CF102}'
const toolbarPluginConfigPath = '/onlyoffice-plugins/empower-toolbar/config.json'
const toolbarPluginMessageSource = 'empower-toolbar-plugin'
const toolbarPluginCompareMessageType = 'empower-toolbar:compare-file-selected'
const pluginCompareMaxFileSize = Number(import.meta.env.VITE_MAX_FILE_SIZE) || 10 * 1024 * 1024

const runtimeRevisedFile = ref<{ name: string, url: string } | null>(null)
const isUploadingPluginCompareFile = ref(false)

// OnlyOffice localStorage 键名常量
const ONLYOFFICE_STORAGE_PREFIXES = [
  'asc-',        // OnlyOffice 前缀
  'onlyoffice-', // 备用前缀
  ''             // 无前缀（某些情况）
] as const

const SPELLCHECK_STORAGE_PATTERNS = [
  'spellcheck',
  'spelling',
  'sc-enabled'
] as const

/**
 * 清除 OnlyOffice 拼写检查相关的 localStorage
 * 使用前缀匹配模式，确保清除所有相关键
 */
const clearSpellcheckCache = (): { cleared: number, errors: string[] } => {
  const clearedKeys: string[] = []
  const errors: string[] = []

  try {
    // 检查 localStorage 是否可用
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      errors.push('localStorage 不可用（可能在 SSR 环境）')
      return { cleared: 0, errors }
    }

    // 测试写入权限（隐私模式检测）
    const testKey = '__onlyoffice_storage_test__'
    try {
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
    } catch (accessError) {
      errors.push('localStorage 不可写（可能在隐私模式或被禁用）')
      return { cleared: 0, errors }
    }

    // 扫描所有 localStorage 键，进行模糊匹配
    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      const keyLower = key.toLowerCase()
      // 匹配包含 spellcheck 或 spelling 的键
      if (SPELLCHECK_STORAGE_PATTERNS.some(pattern =>
        keyLower.includes(pattern) || keyLower.includes(pattern.replace('-', ''))
      )) {
        try {
          localStorage.removeItem(key)
          clearedKeys.push(key)
        } catch (removeError) {
          errors.push(`无法清除键 ${key}: ${removeError}`)
        }
      }
    }

    // 记录日志
    if (clearedKeys.length > 0) {
      logger.log(`✅ 已清除 ${clearedKeys.length} 个拼写检查缓存:`, clearedKeys)
    } else {
      logger.log('ℹ️ 未发现拼写检查缓存')
    }

    if (errors.length > 0) {
      logger.warn('⚠️ 清除拼写检查缓存时发生错误:', errors)
    }

    return { cleared: clearedKeys.length, errors }
  } catch (error) {
    errors.push(`清除缓存时发生异常: ${error}`)
    logger.error('清除拼写检查缓存失败:', error)
    return { cleared: 0, errors }
  }
}

const internalEditorId = computed(() => props.editorId || 'onlyoffice-editor')

const toReachableUrl = (url?: string) => {
  if (!url) return ''
  if (props.isPublicUrl) return url

  if (fileAccessBaseUrl && url.startsWith(window.location.origin)) {
    return url.replace(window.location.origin, fileAccessBaseUrl)
  }

  try {
    const parsed = new URL(url)
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (isLocalhost && fileAccessHost) {
      parsed.hostname = fileAccessHost
      return parsed.toString()
    }
  } catch (error) {
    logger.warn('文件 URL 解析失败，使用原始地址:', url, error)
  }

  return url
}

const comparePayload = computed<CompareRequestPayload | null>(() => {
  if (runtimeRevisedFile.value) {
    return {
      c: 'compare',
      fileType: 'docx',
      key: generateKey(),
      title: runtimeRevisedFile.value.name,
      url: toReachableUrl(runtimeRevisedFile.value.url)
    }
  }

  if (!props.revisedFileUrl) {
    return null
  }

  const fileType = getFileType(props.revisedFile?.name || props.revisedFileUrl)
  return {
    c: 'compare',
    fileType,
    key: generateKey(),
    title: props.revisedFile?.name || 'revised.docx',
    url: toReachableUrl(props.revisedFileUrl)
  }
})

const toolbarPluginConfigUrl = computed(() => {
  const appendVersion = (url: string) => {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}v=${encodeURIComponent(toolbarPluginVersion)}&t=${encodeURIComponent(toolbarPluginRequestNonce)}`
  }

  const localUrl = typeof window === 'undefined'
    ? toolbarPluginConfigPath
    : `${window.location.origin}${toolbarPluginConfigPath}`

  if (useRemoteToolbarPlugin && toolbarPluginConfigUrlFromEnv) {
    return appendVersion(toolbarPluginConfigUrlFromEnv)
  }

  return appendVersion(localUrl)
})

const getAllowedPluginMessageOrigins = () => {
  const origins = new Set<string>()

  const appendOrigin = (url?: string) => {
    if (!url) return
    try {
      origins.add(new URL(url, window.location.origin).origin)
    } catch (error) {
      logger.warn('解析插件消息来源失败:', url, error)
    }
  }

  origins.add(window.location.origin)
  appendOrigin(props.documentServerUrl)
  appendOrigin(toolbarPluginConfigUrl.value)

  return origins
}

const config = computed<OnlyOfficeConfig | null>(() => {
  // 在计算配置前先清除缓存
  clearSpellcheckCache()

  if (!props.fileUrl) {
    return null
  }

  const fileType = getFileType(props.file?.name || '')
  const documentType = getDocumentType(fileType)
  const key = generateKey()
  const isEditMode = props.mode !== 'view'
  const canEnableReview = props.mode !== 'view' && fileType === 'docx' && documentType === 'word'

  return {
    document: {
      fileType,
      key,
      title: props.file?.name || 'document',
      url: toReachableUrl(props.fileUrl),
      permissions: {
        edit: props.mode === 'edit',
        review: canEnableReview,
        download: true,
        print: true
      }
    },
    documentType,
    editorConfig: {
      mode: isEditMode ? 'edit' : 'view',
      callbackUrl: props.mode === 'edit' ? '' : undefined,
      lang: 'zh-CN',
      plugins: props.mode !== 'view' ? {
        autostart: [toolbarPluginGuid],
        pluginsData: [toolbarPluginConfigUrl.value]
      } : undefined,
      customization: {
        uiTheme: props.uiTheme || 'theme-light',
        features: {
          // 使用布尔值形式，完全禁用拼写检查
          // 这是推荐的方式，比对象形式 { mode: false } 更直接
          spellcheck: false
        }
      }
    }
  }
})

const triggerCompare = () => {
  const payload = comparePayload.value
  if (!payload) {
    emit('error', '缺少对比文档，请先上传两个文档')
    return false
  }

  const editor = (window as { DocEditor?: { instances?: Record<string, DocEditorInstance | undefined> } })
    .DocEditor?.instances?.[internalEditorId.value]
  if (!editor) {
    emit('error', '编辑器尚未就绪，请稍后再试')
    return false
  }

  if (typeof editor.setRequestedDocument === 'function') {
    editor.setRequestedDocument(payload)
    logger.log('调用 setRequestedDocument(compare) 成功')
    return true
  }

  if (typeof editor.setRevisedFile === 'function') {
    const { c, ...legacyPayload } = payload
    editor.setRevisedFile(legacyPayload)
    logger.log('调用 setRevisedFile(compare) 成功')
    return true
  }

  emit('error', '当前 OnlyOffice 实例不支持对比 API')
  return false
}

const onDocumentReady = () => {
  logger.log('✅ 文档加载完成:', props.mode)
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

  emit('error', `${message}（错误码: ${event.errorCode}）`)
}

const onDocumentStateChange = (event: { data: boolean }) => {
  emit('stateChanged', event.data)
}

const onRequestSelectDocument = () => {
  if (!comparePayload.value) {
    emit('error', '请先通过“文档对比”按钮上传修订文档')
    return
  }

  triggerCompare()
}

const validatePluginCompareFile = (file: File): string => {
  if (getFileType(file.name) !== 'docx') {
    return '仅支持上传 .docx 作为对比文档'
  }

  if (file.size > pluginCompareMaxFileSize) {
    const maxSizeMB = (pluginCompareMaxFileSize / 1024 / 1024).toFixed(0)
    return `对比文档大小不能超过 ${maxSizeMB}MB`
  }

  return ''
}

const uploadAndCompareByPluginFile = async (file: File) => {
  if (props.mode === 'view') {
    emit('error', '查看模式不支持文档对比，请切换到编辑模式')
    return
  }

  const baseType = getFileType(props.file?.name || props.fileUrl || '')
  if (baseType !== 'docx') {
    emit('error', '当前文档不是 .docx，无法进行文档对比')
    return
  }

  const validationError = validatePluginCompareFile(file)
  if (validationError) {
    emit('error', validationError)
    return
  }

  if (isUploadingPluginCompareFile.value) {
    emit('error', '正在上传对比文档，请稍后再试')
    return
  }

  isUploadingPluginCompareFile.value = true
  try {
    const uploadedUrl = await uploadFile(file)
    runtimeRevisedFile.value = {
      name: file.name,
      url: uploadedUrl
    }
    triggerCompare()
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '对比文档上传失败')
  } finally {
    isUploadingPluginCompareFile.value = false
  }
}

const onToolbarPluginMessage = async (event: MessageEvent) => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  const payload = data as Record<string, unknown>
  if (
    payload.source !== toolbarPluginMessageSource ||
    payload.type !== toolbarPluginCompareMessageType
  ) {
    return
  }

  const allowedOrigins = getAllowedPluginMessageOrigins()
  if (event.origin && !allowedOrigins.has(event.origin)) {
    logger.warn('忽略来自未知来源的插件消息:', event.origin)
    return
  }

  const file = payload.file
  if (!(file instanceof File)) {
    emit('error', '未读取到对比文档，请重新选择')
    return
  }

  await uploadAndCompareByPluginFile(file)
}

watch(
  () => props.fileUrl,
  () => {
    runtimeRevisedFile.value = null
  }
)

onMounted(() => {
  window.addEventListener('message', onToolbarPluginMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onToolbarPluginMessage)
})

defineExpose({
  startCompare: triggerCompare
})
</script>

<template>
  <DocumentEditor
    v-if="config"
    :id="internalEditorId"
    :documentServerUrl="documentServerUrl"
    :config="config"
    height="100%"
    width="100%"
    :events_onDocumentReady="onDocumentReady"
    :events_onDocumentStateChange="onDocumentStateChange"
    :events_onRequestSelectDocument="onRequestSelectDocument"
    :events_onRequestCompareFile="onRequestSelectDocument"
    :onLoadComponentError="onLoadComponentError"
  />
  <div v-else class="empty">请选择文件</div>
</template>

<style scoped>
.empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: #667085;
  font-size: 14px;
}
</style>
