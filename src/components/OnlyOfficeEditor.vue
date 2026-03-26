<script setup lang="ts">
import { computed } from 'vue'
import { DocumentEditor } from '@onlyoffice/document-editor-vue'
import type { OnlyOfficeConfig, ComponentErrorEvent, OnlyOfficeUiTheme } from '@/types/onlyoffice'
import { getFileType, getDocumentType, generateKey } from '@/utils/fileHelper'
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

interface InsertImagePayload {
  c: 'add'
  images: Array<{
    fileType: string
    url: string
  }>
  token?: string
}

interface DocEditorInstance {
  setRequestedDocument?: (payload: CompareRequestPayload) => void
  setRevisedFile?: (payload: Omit<CompareRequestPayload, 'c'>) => void
  insertImage?: (payload: InsertImagePayload) => void
}

const props = defineProps<Props>()
const emit = defineEmits<{
  documentReady: []
  error: [message: string]
  stateChanged: [isModified: boolean]
}>()

const fileAccessBaseUrl = import.meta.env.VITE_FILE_ACCESS_BASE_URL as string | undefined
const fileAccessHost = import.meta.env.VITE_FILE_ACCESS_HOST as string | undefined

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
  if (props.mode !== 'compare' || !props.revisedFileUrl) {
    return null
  }

  const fileType = getFileType(props.revisedFile?.name || '')
  return {
    c: 'compare',
    fileType,
    key: generateKey(),
    title: props.revisedFile?.name || 'revised.docx',
    url: toReachableUrl(props.revisedFileUrl)
  }
})

const config = computed<OnlyOfficeConfig | null>(() => {
  if (!props.fileUrl) {
    return null
  }

  const fileType = getFileType(props.file?.name || '')
  const documentType = getDocumentType(fileType)
  const key = generateKey()
  const isEditMode = props.mode !== 'view'

  return {
    document: {
      fileType,
      key,
      title: props.file?.name || 'document',
      url: toReachableUrl(props.fileUrl),
      permissions: {
        edit: props.mode === 'edit',
        review: props.mode === 'compare',
        download: true,
        print: true
      }
    },
    documentType,
    editorConfig: {
      mode: isEditMode ? 'edit' : 'view',
      callbackUrl: props.mode === 'edit' ? '' : undefined,
      lang: 'zh-CN',
      customization: {
        uiTheme: props.uiTheme || 'theme-light'
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

  emit('error', message)
}

const onDocumentStateChange = (event: { data: boolean }) => {
  emit('stateChanged', event.data)
}

const onRequestSelectDocument = () => {
  if (props.mode === 'compare') {
    triggerCompare()
  }
}

const insertImage = (imageUrl: string, fileType: string = 'png') => {
  const editor = (window as { DocEditor?: { instances?: Record<string, DocEditorInstance | undefined> } })
    .DocEditor?.instances?.[internalEditorId.value]

  if (!editor) {
    emit('error', '编辑器尚未就绪，请稍后再试')
    return false
  }

  if (typeof editor.insertImage === 'function') {
    // 转换 URL 为 Docker 容器可访问的地址
    const reachableUrl = toReachableUrl(imageUrl)
    const payload: InsertImagePayload = {
      c: 'add',
      images: [
        {
          fileType,
          url: reachableUrl
        }
      ]
    }
    editor.insertImage(payload)
    logger.log('✅ 调用 insertImage 成功:', reachableUrl)
    return true
  }

  emit('error', '当前 OnlyOffice 实例不支持插入图片 API')
  return false
}

defineExpose({
  startCompare: triggerCompare,
  insertImage
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
