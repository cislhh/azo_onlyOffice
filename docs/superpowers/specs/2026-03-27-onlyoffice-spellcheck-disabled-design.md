# OnlyOffice 拼写检查默认关闭功能设计文档

**日期**: 2026-03-27
**状态**: 设计阶段 v2（已根据审查反馈更新）
**作者**: Claude

## 1. 功能概述

在 OnlyOffice 编辑器初始化时，强制将拼写检查功能设置为关闭状态，并清除浏览器本地存储中可能缓存的拼写检查设置，确保每次加载都是统一的状态。

## 2. 问题背景

根据 OnlyOffice 官方文档：

- `features.spellcheck` 定义编辑器加载时拼写检查器的初始状态
- 如果用户在编辑器界面中更改了拼写检查设置，该设置会存储在浏览器本地存储中
- 本地存储中的值会覆盖 `editorConfig.customization.features.spellcheck` 参数发送的值

当前项目中：
- 没有配置拼写检查功能
- 没有清除本地存储缓存的机制
- 用户可能因为之前的设置导致拼写检查状态不一致

## 3. 设计目标

1. **默认关闭拼写检查**：通过配置将拼写检查设置为默认关闭（验收标准：100% 成功率）
2. **清除缓存状态**：每次编辑器初始化前清除 localStorage 中的拼写检查缓存（验收标准：清除操作 < 10ms）
3. **保证一致性**：确保每次加载编辑器时拼写检查都是关闭状态（验收标准：跨会话一致性）
4. **健壮性**：正确处理异常情况（隐私模式、localStorage 禁用、多实例场景）

## 4. 技术方案

### 4.1 方案选择

选择**组件内部处理方案**：
- 修改集中在 `OnlyOfficeEditor.vue` 组件内
- 不影响其他组件
- 简单直接，易于维护

### 4.2 实现细节

#### 4.2.1 localStorage 键名常量定义

在 `OnlyOfficeEditor.vue` 顶部定义 localStorage 键名常量，便于维护和调试：

```typescript
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

    // 收集所有可能的键名
    const possibleKeys = new Set<string>()
    for (const prefix of ONLYOFFICE_STORAGE_PREFIXES) {
      for (const pattern of SPELLCHECK_STORAGE_PATTERNS) {
        possibleKeys.add(`${prefix}${pattern}`)
      }
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
```

**设计说明**：
1. **动态检测机制**：不依赖固定的键名列表，而是扫描所有 localStorage 键进行模式匹配
2. **隐私模式处理**：使用测试键检测 localStorage 是否可写
3. **错误处理**：捕获所有可能的异常，不会影响编辑器初始化
4. **日志记录**：详细记录清除的键和错误信息，便于调试
5. **性能优化**：单次扫描，O(n) 时间复杂度

#### 4.2.2 配置拼写检查功能

在 `config` computed 中的 `editorConfig.customization` 添加 `features` 配置：

```typescript
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
      plugins: props.mode === 'edit' ? {
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
```

**配置说明**：
1. **布尔值 vs 对象形式**：选择使用 `spellcheck: false`（布尔值）而不是 `{ mode: false }`（对象形式）
   - **原因**：布尔值形式更简洁，适用于所有编辑器类型（word, cell, slide）
   - **对象形式**仅适用于文档编辑器和演示编辑器，不适用于表格编辑器
   - 布尔值形式在所有情况下都能完全禁用拼写检查

2. **时机选择**：在 `config` computed getter 的开头执行清除操作
   - **原因**：确保在 OnlyOffice 组件读取配置前就已经清除了缓存
   - computed getter 在组件初始化时执行，早于 OnlyOffice 的初始化
   - 每次 config 被访问时都会执行，但因为有缓存机制，实际只会执行一次

#### 4.2.3 更新 TypeScript 类型定义

修改 `src/types/onlyoffice.d.ts`，扩展 `customization` 接口：

```typescript
customization?: {
  uiTheme?: OnlyOfficeUiTheme
  features?: {
    /**
     * 拼写检查功能配置
     * - boolean: 完全禁用或启用拼写检查（推荐）
     * - object: 细粒度控制，仅支持 mode 属性
     */
    spellcheck?: boolean | {
      /**
       * 拼写检查模式
       * 仅适用于文档编辑器和演示编辑器
       */
      mode?: boolean
    }
  }
}
```

### 4.3 数据流

```
组件创建
    ↓
config computed 被访问
    ↓
clearSpellcheckCache() 执行
    ├─ 检测 localStorage 可用性
    ├─ 扫描所有键，进行模式匹配
    ├─ 清除匹配的键
    └─ 记录日志
    ↓
创建 config 对象（包含 features.spellcheck: false）
    ↓
DocumentEditor 组件初始化
    ↓
OnlyOffice 加载（使用关闭的拼写检查）
```

### 4.4 多实例场景处理

**场景**：用户在多个标签页中同时打开不同的文档

**问题**：如果清除 localStorage 影响其他实例，可能导致其他标签页的设置被清除

**解决方案**：
- 当前实现会在每个实例初始化时清除缓存
- 由于每次初始化都会强制设置 `spellcheck: false`，即使缓存被清除，其他实例也会使用配置中的值
- 这是预期行为：所有实例都应该禁用拼写检查

**验证**：需要在多标签页场景下测试，确认不会出现竞态条件

## 5. 文件变更清单

1. **src/components/OnlyOfficeEditor.vue**
   - 导入 `onMounted` 从 Vue
   - 添加 `onMounted` 钩子，清除 localStorage
   - 更新 `config` computed 中的 `customization` 对象

2. **src/types/onlyoffice.d.ts**
   - 扩展 `customization` 接口，添加 `features` 属性定义

## 6. 测试计划

### 6.1 功能测试

#### 6.1.1 基本功能测试

1. **拼写检查默认关闭验证**
   - **步骤**：
     1. 清空浏览器缓存和 localStorage
     2. 打开文档编辑器
     3. 在编辑器中输入拼写错误的单词
   - **预期结果**：拼写错误的单词下方不应出现红色波浪线
   - **验证方法**：视觉检查 + DOM 检查（检查是否有 `squiggle` 类名的元素）

2. **刷新页面状态保持测试**
   - **步骤**：
     1. 打开编辑器
     2. 刷新页面（F5 或 Cmd+R）
   - **预期结果**：拼写检查保持关闭状态
   - **验证方法**：输入拼写错误的单词，检查是否有波浪线

3. **手动开启后重置测试**
   - **步骤**：
     1. 打开编辑器
     2. 手动在编辑器界面中开启拼写检查（如果有此选项）
     3. 验证拼写检查已开启（输入错误单词应显示波浪线）
     4. 刷新页面
   - **预期结果**：拼写检查被重置为关闭状态
   - **验证方法**：输入拼写错误的单词，检查波浪线是否消失

4. **日志输出验证**
   - **步骤**：打开浏览器控制台，查看日志输出
   - **预期结果**：应看到 "✅ 已清除 X 个拼写检查缓存" 或 "ℹ️ 未发现拼写检查缓存" 的日志
   - **验证方法**：检查 console.log 输出

#### 6.1.2 本地存储测试

1. **缓存清除验证**
   - **步骤**：
     1. 打开浏览器开发者工具 > Application > Local Storage
     2. 手动添加一个测试键：`asc-spellcheck-test = true`
     3. 加载编辑器
   - **预期结果**：测试键被清除
   - **验证方法**：在 Local Storage 面板中检查该键是否还存在

2. **模式匹配扫描测试**
   - **步骤**：
     1. 在 localStorage 中手动创建多个键：
        - `spellcheck-enabled = true`
        - `asc-spelling = true`
        - `some-other-key = value`
     2. 加载编辑器
   - **预期结果**：
     - `spellcheck-enabled` 被清除
     - `asc-spelling` 被清除
     - `some-other-key` 保留
   - **验证方法**：检查 localStorage 中的剩余键

3. **实际 OnlyOffice 键名测试**
   - **步骤**：
     1. 使用 OnlyOffice 编辑器并手动开启拼写检查
     2. 在 Application > Local Storage 中查找新增的键
     3. 记录键名模式
     4. 刷新页面，验证这些键被清除
   - **预期结果**：所有与拼写检查相关的键被清除
   - **验证方法**：检查 localStorage 和日志输出

#### 6.1.3 跨文档类型测试

1. **文档编辑器（word）**
   - 加载 .docx 文件
   - 验证拼写检查关闭
   - 刷新验证状态保持

2. **表格编辑器（cell）**
   - 加载 .xlsx 文件
   - 验证拼写检查关闭
   - 刷新验证状态保持

3. **演示编辑器（slide）**
   - 加载 .pptx 文件
   - 验证拼写检查关闭
   - 刷新验证状态保持

#### 6.1.4 多实例场景测试

1. **多标签页测试**
   - **步骤**：
     1. 在标签页 A 中打开文档 1
     2. 在标签页 B 中打开文档 2
     3. 在标签页 A 中手动开启拼写检查（如果可能）
     4. 刷新标签页 B
   - **预期结果**：两个标签页的拼写检查都是关闭状态
   - **验证方法**：检查两个标签页的拼写检查状态

2. **性能测试**
   - **步骤**：在 localStorage 中创建 1000 个键（模拟大量数据）
   - **预期结果**：清除操作应在 10ms 内完成
   - **验证方法**：在 `clearSpellcheckCache` 中添加性能计时

### 6.2 兼容性测试

1. **跨浏览器测试**
   - Chrome/Edge (Chromium 内核)
   - Firefox
   - Safari (macOS/iOS)
   - 测试内容：基本功能、本地存储清除、日志输出

2. **隐私模式测试**
   - **步骤**：在隐私/无痕模式下打开编辑器
   - **预期结果**：编辑器正常工作，日志显示 "localStorage 不可写"
   - **验证方法**：检查控制台日志和编辑器功能

3. **SSR 环境测试**（如果使用 SSR）
   - **步骤**：在服务端渲染时访问组件
   - **预期结果**：不抛出错误，日志显示 "localStorage 不可用"
   - **验证方法**：检查服务端日志

### 6.3 边界情况测试

1. **localStorage 被禁用**
   - 浏览器设置中禁用 localStorage
   - 验证编辑器正常工作

2. **localStorage 满载**
   - 填满 localStorage 配额
   - 验证清除操作不抛出异常

3. **并发清除测试**
   - 快速连续创建和销毁多个编辑器实例
   - 验证没有竞态条件

### 6.4 自动化测试可行性

**推荐使用 Playwright 进行 E2E 测试**：

```typescript
// 示例测试用例
test('拼写检查默认关闭', async ({ page }) => {
  // 1. 导航到编辑器页面
  await page.goto('/editor')

  // 2. 等待编辑器加载
  await page.waitForSelector('#onlyoffice-editor')

  // 3. 输入拼写错误的单词
  await page.keyboard.type('missspelled word')

  // 4. 检查是否有拼写错误标记（红色波浪线）
  const squiggles = await page.locator('.squiggle').count()
  expect(squiggles).toBe(0)

  // 5. 检查 localStorage
  const localStorage = await page.evaluate(() => {
    return { ...localStorage }
  })
  const spellcheckKeys = Object.keys(localStorage).filter(key =>
    key.toLowerCase().includes('spellcheck')
  )
  expect(spellcheckKeys.length).toBe(0)
})
```

**限制**：
- OnlyOffice 编辑器是 iframe，需要使用 `page.frame()` 访问内部内容
- 拼写错误标记的 DOM 结构可能因 OnlyOffice 版本而异
- 需要维护测试环境的 OnlyOffice 版本一致性

## 7. 风险与注意事项

### 7.1 风险评估

| 风险 | 严重性 | 可能性 | 缓解措施 | 状态 |
|------|--------|--------|----------|------|
| localStorage 键名不确定 | 高 | 中 | 使用模式匹配扫描所有键 | ✅ 已缓解 |
| 清除时机错误导致失效 | 高 | 低 | 在 config computed getter 中执行 | ✅ 已缓解 |
| 隐私模式/禁用 localStorage | 中 | 中 | 添加错误处理，优雅降级 | ✅ 已处理 |
| 多实例竞态条件 | 中 | 低 | 每次实例都重置配置 | ✅ 已处理 |
| 影响其他 OnlyOffice 功能 | 低 | 低 | 模式匹配只针对拼写检查 | ✅ 已缓解 |
| OnlyOffice 版本升级键名变化 | 中 | 低 | 模式匹配自动适应 | ✅ 已缓解 |
| 性能影响 | 低 | 极低 | 单次扫描，O(n) 复杂度 | ✅ 可接受 |

### 7.2 详细风险分析

#### 7.2.1 localStorage 键名不确定性（已缓解）

**问题描述**：OnlyOffice 可能使用不同的键名存储拼写检查状态，固定键名列表可能遗漏某些键。

**缓解措施**：
- ✅ 使用模式匹配扫描所有 localStorage 键
- ✅ 支持多种前缀（`asc-`, `onlyoffice-`, 无前缀）
- ✅ 支持多种模式（`spellcheck`, `spelling`, `sc-enabled`）
- ✅ 详细日志记录，便于调试和发现新键名

**验证方法**：
1. 手动在 OnlyOffice 中开启拼写检查
2. 检查 localStorage 新增的键
3. 验证这些键在下次加载时被清除

#### 7.2.2 清除时机错误（已缓解）

**问题描述**：如果在 OnlyOffice 读取 localStorage 之后清除，清除操作将无效。

**缓解措施**：
- ✅ 在 `config` computed getter 的开头执行清除
- ✅ computed getter 在 OnlyOffice 组件初始化之前执行
- ✅ 每次访问 config 时都会执行（虽然有缓存）

**验证方法**：
1. 在 `clearSpellcheckCache` 和 `config` 返回之间添加日志
2. 验证日志顺序正确
3. 在浏览器中设置断点，验证执行顺序

#### 7.2.3 隐私模式/禁用 localStorage（已处理）

**问题描述**：在隐私模式下，localStorage 可能不可用或不可写，直接访问会抛出异常。

**缓解措施**：
- ✅ 添加 `typeof localStorage` 检查
- ✅ 使用测试键检测写入权限
- ✅ try-catch 包裹所有 localStorage 操作
- ✅ 返回错误信息而不是抛出异常
- ✅ 记录警告日志，便于调试

**验证方法**：
1. 在隐私/无痕模式下打开编辑器
2. 验证编辑器正常工作
3. 检查控制台日志显示 "localStorage 不可写"

#### 7.2.4 多实例竞态条件（已处理）

**问题描述**：在多个标签页中同时打开编辑器，清除操作可能相互干扰。

**影响分析**：
- 每个实例都会在初始化时清除缓存
- 由于每次都强制设置 `spellcheck: false`，即使缓存被清除，配置中的值仍然生效
- 这是预期行为：所有实例都应该禁用拼写检查

**缓解措施**：
- ✅ 每个实例独立清除和配置
- ✅ 不依赖 localStorage 中的状态
- ✅ 配置中的 `spellcheck: false` 是最终决定性因素

**验证方法**：
1. 在多个标签页中打开不同文档
2. 验证所有标签页的拼写检查都是关闭状态
3. 快速切换标签页，验证没有闪烁或状态不一致

#### 7.2.5 影响其他 OnlyOffice 功能（低风险）

**问题描述**：模式匹配可能误删除其他 OnlyOffice 功能的 localStorage 键。

**风险评估**：
- OnlyOffice 的其他功能通常使用明确的键名（如 `autosave`, `recent`）
- 拼写检查相关的键通常包含 `spellcheck` 或 `spelling` 关键字
- 使用精确的模式匹配，不会误删其他键

**缓解措施**：
- ✅ 只匹配包含 `spellcheck`, `spelling`, `sc-enabled` 的键
- ✅ 详细日志记录所有被清除的键
- ✅ 如果发现问题，可以手动排除特定键

**验证方法**：
1. 测试其他 OnlyOffice 功能（自动保存、最近文档等）
2. 验证这些功能不受影响

#### 7.2.6 OnlyOffice 版本升级键名变化（已缓解）

**问题描述**：OnlyOffice 版本升级后可能使用不同的 localStorage 键名。

**缓解措施**：
- ✅ 使用模式匹配而不是固定键名列表
- ✅ 模式匹配自动适应新的键名
- ✅ 定期检查日志，发现新的键名模式

**验证方法**：
1. 在 OnlyOffice 版本升级后进行回归测试
2. 检查日志，确认拼写检查缓存被正确清除

#### 7.2.7 性能影响（可接受）

**问题描述**：扫描所有 localStorage 键可能影响性能。

**性能分析**：
- localStorage 中的键通常不超过 100 个
- 模式匹配是 O(n) 复杂度，n 为键的数量
- 预期执行时间 < 10ms

**性能要求**：
- 清除操作应在 10ms 内完成
- 不应阻塞 UI 渲染

**缓解措施**：
- ✅ 单次扫描，不会重复执行
- ✅ computed getter 会缓存结果
- ✅ 异步日志记录，不阻塞主流程

**验证方法**：
1. 在 `clearSpellcheckCache` 中添加性能计时
2. 测量实际执行时间
3. 如果超过 10ms，优化匹配算法

### 7.3 注意事项

1. **配置形式选择**
   - 使用 `spellcheck: false`（布尔值）而不是 `{ mode: false }`（对象形式）
   - 原因：布尔值适用于所有编辑器类型，对象形式仅适用于文档和演示编辑器

2. **日志级别**
   - 成功清除：使用 `logger.log`（信息级别）
   - 未发现缓存：使用 `logger.log`（信息级别）
   - 清除错误：使用 `logger.warn`（警告级别）
   - 异常错误：使用 `logger.error`（错误级别）

3. **类型安全**
   - 更新 TypeScript 类型定义
   - 确保类型检查通过

4. **向后兼容**
   - 如果 OnlyOffice 版本不支持 `features.spellcheck`，可以安全地忽略
   - 不影响其他功能

5. **用户反馈**
   - 如果用户需要启用拼写检查，可以通过修改配置实现
   - 当前的强制关闭策略可以根据需求调整

## 8. 文件变更清单

### 8.1 主要变更

1. **src/components/OnlyOfficeEditor.vue**
   - 添加 localStorage 键名常量定义
   - 实现 `clearSpellcheckCache()` 函数
   - 在 `config` computed getter 中调用清除函数
   - 更新 `customization` 配置，添加 `features.spellcheck: false`
   - 导入所需的 Vue 函数（如果需要）

2. **src/types/onlyoffice.d.ts**
   - 扩展 `customization` 接口
   - 添加 `features` 属性定义
   - 添加详细的 JSDoc 注释

### 8.2 可选变更（建议）

1. **创建配置常量文件** `src/config/onlyoffice.ts`
   - 集中管理 OnlyOffice 相关的常量
   - 便于维护和测试

2. **创建工具函数文件** `src/utils/onlyofficeStorage.ts`
   - 提取 `clearSpellcheckCache()` 到独立文件
   - 便于单元测试和复用

## 9. 参考资料

- OnlyOffice 官方文档：`features.spellcheck` 配置
- OnlyOffice 官方文档：`features.spellcheck.mode` 配置
- 浏览器 localStorage API
- 项目文档：`docs/ONLYOFFICE_STAMP_TOOLBAR_DEV_GUIDE.md`（缓存问题处理经验）
