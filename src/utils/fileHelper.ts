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
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * 上传文件到服务器
 * @param file 要上传的文件
 * @returns 上传后的完整 HTTP URL（Docker 可访问）
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

  // 获取当前页面的完整 URL
  const baseUrl = window.location.origin
  const fullPath = `${baseUrl}${result.url}`

  return fullPath  // 返回完整 URL: http://localhost:5174/temp/xxx.docx
}
