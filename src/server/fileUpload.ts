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
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }

        try {
          // 读取请求体
          const chunks: Buffer[] = []
          req.on('data', (chunk) => chunks.push(chunk))

          req.on('end', () => {
            try {
              // 简单的 multipart 解析（实际生产环境建议使用 formidable 或 multer）
              const buffer = Buffer.concat(chunks)
              const body = buffer.toString('binary')

              // 提取文件名和内容
              const filenameMatch = body.match(/Content-Disposition.*filename="(.+?)"/)
              const filename = filenameMatch?.[1] ?? `file-${Date.now()}.docx`

              // 查找文件内容开始位置
              const boundaryStart = body.indexOf('\r\n\r\n')
              const fileData = buffer.slice(buffer.indexOf('\r\n\r\n') + 4)

              // 去除最后的boundary标记
              const endBoundary = fileData.lastIndexOf('\r\n--')
              const cleanData = endBoundary > 0 ? fileData.slice(0, endBoundary) : fileData

              // 保存文件
              const filepath = path.join(tempDir, filename)
              fs.writeFileSync(filepath, cleanData)

              // 返回URL
              const url = `/temp/${filename}`
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ url }))
            } catch (error) {
              console.error('文件上传处理错误:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: '文件处理失败' }))
            }
          })
        } catch (error) {
          console.error('上传请求错误:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: '上传失败' }))
        }
      })
    }
  }
}
