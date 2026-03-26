# OnlyOffice 本地开发问题说明

## ✅ 问题已解决

> **解决方案**：在 OnlyOffice Docker 容器启动时添加环境变量 `ALLOW_PRIVATE_IP_ADDRESS=true`

---

## 问题回顾

### 症状
- 文件上传成功（可以看到 `public/temp/` 目录中的文件）
- 控制台显示正确的 URL 转换：`http://192.168.0.196:5173/temp/old.docx`
- OnlyOffice 编辑器提示"下载失败"

### 根本原因

**OnlyOffice Document Server 的安全限制**：OnlyOffice Docker 容器默认会阻止访问私有 IP 地址，包括：
- `localhost` / `127.0.0.1`
- `192.168.x.x`（私有网络）
- `10.x.x.x`（A类私有网络）
- `172.16-31.x.x`（B类私有网络）

这是为了防止 SSRF（Server-Side Request Forgery）攻击。

### Docker 日志证据
```
Error: DNS lookup 192.168.0.196 is not allowed. Because, It is private IP address.
```

---

## ✅ 最终解决方案

### 启动 OnlyOffice Docker 容器（本地开发）

```bash
docker run -i -t -d -p 80:80 \
  -e JWT_ENABLED=false \
  -e ONLYOFFICE_HTTPS_HSTS_ENABLED=false \
  -e ALLOW_PRIVATE_IP_ADDRESS=true \
  onlyoffice/documentserver
```

**关键环境变量**：
- `JWT_ENABLED=false` - 禁用 JWT 验证（本地开发）
- `ALLOW_PRIVATE_IP_ADDRESS=true` - **允许访问私有 IP 地址**
- `ONLYOFFICE_HTTPS_HSTS_ENABLED=false` - 禁用 HSTS（本地开发）

### 验证容器运行

```bash
# 检查容器状态
docker ps --filter "ancestor=onlyoffice/documentserver"

# 检查环境变量
docker inspect <container-id> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ALLOW

# 查看日志
docker logs <container-id> --tail 50
```

---

## 环境配置指南

### 开发环境（本地）

**特点**：
- 使用私有 IP 地址（localhost / 192.168.x.x）
- 文件存储在本地 `public/temp/` 目录
- 不需要 JWT 验证
- 允许私有 IP 访问

**Docker 启动命令**：
```bash
docker run -i -t -d -p 80:80 \
  -e JWT_ENABLED=false \
  -e ONLYOFFICE_HTTPS_HSTS_ENABLED=false \
  -e ALLOW_PRIVATE_IP_ADDRESS=true \
  onlyoffice/documentserver
```

**Vue 环境变量**（`.env.local`）：
```env
VITE_ONLYOFFICE_URL=http://localhost:80
```

---

### 生产环境

**特点**：
- 使用公网域名/IP 地址
- 文件存储在对象存储（如 AWS S3、阿里云 OSS）
- **必须启用 JWT 验证**（防止未授权访问）
- **不允许私有 IP 访问**（安全考虑）

#### Docker 启动命令

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

#### Vue 环境变量（`.env.production`）

```env
VITE_ONLYOFFICE_URL=https://docs.yourdomain.com
VITE_ONLYOFFICE_JWT_SECRET=your-super-secret-jwt-key
```

#### OnlyOfficeEditor 配置调整

在生产环境中，需要在配置中添加 JWT token：

```typescript
// src/components/OnlyOfficeEditor.vue
const config = computed<OnlyOfficeConfig | null>(() => {
  // ...

  const token = props.mode === 'edit'
    ? generateJwtToken(finalUrl, props.mode) // 生成 JWT token
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
      token: isEditMode ? generateEditorToken() : undefined, // 编辑器配置也需要 token
      lang: 'zh-CN'
    },
    // ...
  }
})
```

---

## 生产环境额外要求

### 1. 文件存储

**开发环境**：
- 文件存储在 `public/temp/` 目录
- 通过 Vite 静态文件服务访问

**生产环境**：
- 使用对象存储服务（AWS S3、阿里云 OSS、腾讯云 COS）
- 文件 URL：`https://your-bucket.s3.amazonaws.com/temp/file.docx`
- 设置合适的 CORS 策略

### 2. 回调 URL（Callback URL）

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
// 示例：回调接口响应格式
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

### 3. HTTPS

**开发环境**：
- 使用 HTTP 即可

**生产环境**：
- **必须使用 HTTPS**
- OnlyOffice 和前端应用都需要 HTTPS
- 配置有效的 SSL 证书

### 4. 安全性检查清单

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

## 快速参考

### Docker 启动命令对比

| 环境 | JWT | 私有 IP | 命令 |
|------|-----|---------|------|
| 开发 | `false` | `true` | `docker run -e JWT_ENABLED=false -e ALLOW_PRIVATE_IP_ADDRESS=true -p 80:80 onlyoffice/documentserver` |
| 生产 | `true` | `false` | `docker run -e JWT_ENABLED=true -e JWT_SECRET=xxx -e ALLOW_PRIVATE_IP_ADDRESS=false -p 80:80 onlyoffice/documentserver` |

### 环境变量对比

| 变量 | 开发环境 | 生产环境 |
|------|----------|----------|
| `VITE_ONLYOFFICE_URL` | `http://localhost:80` | `https://docs.yourdomain.com` |
| `JWT_ENABLED` | `false` | `true` |
| `ALLOW_PRIVATE_IP_ADDRESS` | `true` | `false` |
| `JWT_SECRET` | 不需要 | **必须配置** |

---

## 临时测试方案（开发调试）

如果你想测试公网 URL 而不部署到生产环境，可以使用：

### 方案 A：ngrok（推荐）

```bash
# 安装 ngrok
brew install ngrok

# 启动隧道
ngrok http 5173

# 获得公网 URL，例如：https://abc123.ngrok.io
```

然后临时修改 `src/utils/fileHelper.ts`：
```typescript
const baseUrl = 'https://abc123.ngrok.io'
```

### 方案 B：使用官方 Demo 测试

在**查看模式**中，我已经添加了"使用官方Demo测试"按钮：

**测试步骤**：
1. 访问 http://localhost:5174/office
2. 确保在"查看"标签页
3. 点击"使用官方Demo测试"按钮
4. 应该能成功加载并显示 OnlyOffice 编辑器

这个测试可以验证：
- ✅ OnlyOffice Docker 容器正常运行
- ✅ Vue 组件集成正确
- ✅ 配置对象格式正确

---

## 架构说明

### OnlyOffice Document Server 的工作原理

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Vue App    │────1────▶│ OnlyOffice       │────2────▶│  文件 URL     │
│  (5173)     │  config │ Docker Container │  fetch  │  (必须公网)   │
└─────────────┘         └──────────────────┘         └──────────────┘
                              │
                              │ 3. OnlyOffice 下载文件并渲染
                              ▼
                        ┌──────────────────┐
                        │   浏览器 iframe   │
                        │   显示文档编辑器   │
                        └──────────────────┘
```

**关键点**：第2步，OnlyOffice Docker 容器会主动下载文件URL，所以这个 URL 必须是容器能访问的公网地址。

---

## 代码改动说明

### 1. OfficeView.vue（src/views/OfficeView.vue:34-41）

添加了 `loadDemoFile()` 函数和"使用官方Demo测试"按钮：

```typescript
const loadDemoFile = () => {
  useDemoMode.value = true;
  const demoUrl = 'https://static.onlyoffice.com/assets/docs/samples/demo.docx';
  viewFileUrl.value = demoUrl;
  viewFile.value = new File([], 'demo.docx');
  logger.log('使用官方 Demo URL:', demoUrl);
};
```

### 2. OnlyOfficeEditor.vue（src/components/OnlyOfficeEditor.vue）

- 添加了 `isPublicUrl` prop 来区分公网 URL 和本地 URL
- 公网 URL 直接使用，本地 URL 尝试转换为 Docker 可访问的格式（尽管在当前环境下仍会失败）

---

## 测试清单

- [ ] 使用"官方Demo测试"按钮，验证 OnlyOffice 集成正常工作
- [ ] 确认查看模式可以显示官方 demo 文档
- [ ] 确认编辑模式界面加载（但无法保存，因为没有后端）
- [ ] （可选）设置 ngrok，测试本地文件上传

---

## 参考资料

- [OnlyOffice Vue 官方文档](https://api.onlyoffice.com/zh-CN/docs/docs-api/get-started/frontend-frameworks/vue/)
- [OnlyOffice 官方 Demo](https://api.onlyoffice.com/editors/demo/)
- [OnlyOffice Document Server 文档](https://github.com/ONLYOFFICE/DocumentServer)
- [Docker Hub - onlyoffice/documentserver](https://hub.docker.com/r/onlyoffice/documentserver)
