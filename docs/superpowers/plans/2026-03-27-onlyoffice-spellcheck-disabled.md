# OnlyOffice 拼写检查默认关闭功能实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 在 OnlyOffice 编辑器初始化时强制关闭拼写检查功能，并清除浏览器本地存储中的拼写检查缓存

**架构:**
1. 在 `OnlyOfficeEditor.vue` 组件的 `config` computed getter 中实现动态 localStorage 缓存清除
2. 使用模式匹配扫描所有 localStorage 键，识别并清除拼写检查相关缓存
3. 通过 `editorConfig.customization.features.spellcheck: false` 配置强制关闭拼写检查
4. 更新 TypeScript 类型定义以支持新的配置选项

**技术栈:** Vue 3, TypeScript, OnlyOffice Document Editor API, localStorage API

---

## Chunk 1: TypeScript 类型定义更新

### Task 1: 扩展 OnlyOffice customization 类型定义

**文件:**
- 修改: `src/types/onlyoffice.d.ts`

- [ ] **步骤 1: 备份原始类型定义**

```bash
cp src/types/onlyoffice.d.ts src/types/onlyoffice.d.ts.backup
```

- [ ] **步骤 2: 读取当前类型定义**

查看 `customization` 接口的当前结构

- [ ] **步骤 3: 添加 features 属性到 customization 接口**

找到 `customization` 接口定义（大约在第 38-40 行），修改为：

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
  user?: {
    id: string
    name: string
  }
}
```

**说明:**
- 添加 `features` 可选属性
- `spellcheck` 支持布尔值或对象形式
- 包含详细的 JSDoc 注释说明两种形式的区别

- [ ] **步骤 4: 运行类型检查验证修改**

```bash
pnpm type-check
```

**预期结果:** 类型检查通过，无错误

- [ ] **步骤 5: 提交类型定义更新**

```bash
git add src/types/onlyoffice.d.ts
git commit -m "feat: 扩展 OnlyOffice customization 类型以支持 features.spellcheck 配置

- 添加 features 可选属性
- 支持 spellcheck 布尔值和对象形式
- 添加详细的 JSDoc 注释"
```

---

## Chunk 2: 实现 localStorage 缓存清除功能

### Task 2: 添加 localStorage 键名常量和清除函数

**文件:**
- 修改: `src/components/OnlyOfficeEditor.vue`

- [ ] **步骤 1: 在 script setup 顶部添加常量定义**

在现有的常量定义之后（大约第 48 行之后），添加：

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
```

**说明:**
- 定义 OnlyOffice 可能使用的前缀
- 定义拼写检查相关的键名模式
- 使用 `as const` 确保类型推断为字面量类型

- [ ] **步骤 2: 实现 clearSpellcheckCache 函数**

在常量定义之后，添加清除缓存函数：

```typescript
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
```

**关键特性:**
1. **SSR 环境检测**: 检查 `window` 对象是否存在
2. **隐私模式检测**: 使用测试键验证写入权限
3. **模式匹配**: 扫描所有 localStorage 键，进行模糊匹配
4. **错误处理**: 捕获所有异常，不会影响编辑器初始化
5. **详细日志**: 记录清除的键和错误信息

- [ ] **步骤 3: 在 config computed getter 中调用清除函数**

找到 `const config = computed<OnlyOfficeConfig | null>(() => {` （大约第 105 行），在函数开头添加清除调用：

```typescript
const config = computed<OnlyOfficeConfig | null>(() => {
  // 在计算配置前先清除缓存
  clearSpellcheckCache()

  if (!props.fileUrl) {
    return null
  }
```

**说明:**
- 在 config getter 的开头调用清除函数
- 确保在 OnlyOffice 初始化之前清除缓存
- computed getter 会缓存结果，清除函数只会执行一次

- [ ] **步骤 4: 更新 customization 配置**

找到 `customization` 对象定义（大约第 137-139 行），修改为：

```typescript
customization: {
  uiTheme: props.uiTheme || 'theme-light',
  features: {
    // 使用布尔值形式，完全禁用拼写检查
    // 这是推荐的方式，比对象形式 { mode: false } 更直接
    spellcheck: false
  }
}
```

**说明:**
- 添加 `features` 属性
- 使用布尔值形式 `spellcheck: false`
- 添加注释说明为什么选择布尔值而不是对象形式

- [ ] **步骤 5: 运行类型检查**

```bash
pnpm type-check
```

**预期结果:** 类型检查通过，无错误

- [ ] **步骤 6: 运行开发服务器测试**

```bash
pnpm dev
```

**预期结果:**
- 开发服务器正常启动
- 控制台显示 "✅ 已清除 X 个拼写检查缓存" 或 "ℹ️ 未发现拼写检查缓存"
- 没有 JavaScript 错误

- [ ] **步骤 7: 在浏览器中手动测试**

1. 打开浏览器开发者工具 > Application > Local Storage
2. 手动添加测试键：`localStorage.setItem('asc-spellcheck', 'true')`
3. 导航到编辑器页面
4. 检查 Local Storage，验证测试键被清除
5. 检查控制台日志，确认显示清除信息

- [ ] **步骤 8: 提交实现**

```bash
git add src/components/OnlyOfficeEditor.vue
git commit -m "feat: 实现 OnlyOffice 拼写检查缓存清除和默认关闭功能

- 添加 localStorage 键名常量定义
- 实现 clearSpellcheckCache() 函数
  * 动态检测 localStorage 可用性
  * 隐私模式检测和降级处理
  * 模式匹配扫描所有相关键
  * 完善的错误处理和日志记录
- 在 config computed getter 中调用清除函数
- 配置 features.spellcheck: false 强制关闭拼写检查"
```

---

## Chunk 3: 功能测试和验证

### Task 3: 基本功能测试

- [ ] **步骤 1: 测试拼写检查默认关闭**

1. 清空浏览器缓存和 localStorage
2. 打开文档编辑器，加载一个 .docx 文件
3. 在编辑器中输入拼写错误的单词（如 "missspelled"）
4. 观察单词下方是否出现红色波浪线

**预期结果:** 单词下方不应出现红色波浪线

- [ ] **步骤 2: 测试刷新页面状态保持**

1. 保持编辑器打开
2. 刷新页面（F5 或 Cmd+R）
3. 再次输入拼写错误的单词

**预期结果:** 拼写检查仍然关闭，无红色波浪线

- [ ] **步骤 3: 测试缓存重置**

1. 如果 OnlyOffice 编辑器界面有拼写检查开关，手动开启它
2. 验证拼写检查已开启（输入错误单词应显示波浪线）
3. 刷新页面
4. 输入拼写错误的单词

**预期结果:** 拼写检查被重置为关闭状态

### Task 4: 本地存储测试

- [ ] **步骤 1: 测试缓存清除功能**

1. 打开浏览器开发者工具 > Application > Local Storage
2. 手动添加测试键：
   ```javascript
   localStorage.setItem('asc-spellcheck', 'true')
   localStorage.setItem('onlyoffice-spellcheck-enabled', 'true')
   localStorage.setItem('spellcheck-test', 'value')
   ```
3. 加载编辑器
4. 检查 Local Storage 面板

**预期结果:** 所有测试键都被清除

- [ ] **步骤 2: 验证日志输出**

打开浏览器控制台，查看日志输出

**预期结果:** 应该看到类似以下的日志：
```
[Demo Office] ✅ 已清除 3 个拼写检查缓存: ['asc-spellcheck', 'onlyoffice-spellcheck-enabled', 'spellcheck-test']
```

### Task 5: 跨文档类型测试

- [ ] **步骤 1: 测试文档编辑器 (word)**

1. 加载一个 .docx 文件
2. 验证拼写检查关闭
3. 刷新页面验证状态保持

- [ ] **步骤 2: 测试表格编辑器 (cell)**

1. 加载一个 .xlsx 文件
2. 验证拼写检查关闭
3. 刷新页面验证状态保持

- [ ] **步骤 3: 测试演示编辑器 (slide)**

1. 加载一个 .pptx 文件
2. 验证拼写检查关闭
3. 刷新页面验证状态保持

### Task 6: 边界情况测试

- [ ] **步骤 1: 隐私模式测试**

1. 打开浏览器的隐私/无痕模式
2. 导航到编辑器页面
3. 检查控制台日志

**预期结果:**
- 编辑器正常工作
- 控制台显示 "localStorage 不可写" 警告
- 没有 JavaScript 错误

- [ ] **步骤 2: 性能测试**

在 `clearSpellcheckCache` 函数中添加性能计时（临时测试代码）：

```typescript
const startTime = performance.now()
// ... 现有的清除逻辑 ...
const endTime = performance.now()
logger.log(`清除缓存耗时: ${(endTime - startTime).toFixed(2)}ms`)
```

**预期结果:** 清除操作应在 10ms 内完成

测试完成后移除临时计时代码。

- [ ] **步骤 3: 多标签页测试**

1. 在标签页 A 中打开文档 1
2. 在标签页 B 中打开文档 2
3. 在两个标签页中验证拼写检查都是关闭状态

**预期结果:** 两个标签页的拼写检查都是关闭状态

---

## Chunk 4: 文档更新和提交

### Task 7: 更新项目文档

- [ ] **步骤 1: 检查是否需要更新相关文档**

查看以下文档是否需要更新：
- `docs/ONLYOFFICE_STAMP_TOOLBAR_DEV_GUIDE.md` - 可选：添加拼写检查处理经验

- [ ] **步骤 2: 如果需要，添加简短的缓存处理说明**

在 `docs/ONLYOFFICE_STAMP_TOOLBAR_DEV_GUIDE.md` 中添加新的章节（可选）：

```markdown
## 10. OnlyOffice 缓存管理经验

### 10.1 拼写检查缓存

OnlyOffice 会将拼写检查设置存储在 localStorage 中，覆盖配置中的值。

**解决方案:**
1. 在编辑器初始化前清除 localStorage 中的拼写检查缓存
2. 使用模式匹配扫描所有相关键
3. 通过配置强制关闭拼写检查

**实现位置:** `src/components/OnlyOfficeEditor.vue` 中的 `clearSpellcheckCache()` 函数
```

这步是可选的，根据实际需求决定是否执行。

- [ ] **步骤 3: 提交所有更改**

```bash
# 如果更新了文档
git add docs/

# 最终提交
git commit -m "docs: 更新文档说明 OnlyOffice 拼写检查缓存处理"
```

### Task 8: 最终验证和清理

- [ ] **步骤 1: 运行完整的类型检查**

```bash
pnpm type-check
```

**预期结果:** 无类型错误

- [ ] **步骤 2: 运行构建测试**

```bash
pnpm build
```

**预期结果:** 构建成功

- [ ] **步骤 3: 检查 git 状态**

```bash
git status
```

确保所有更改都已提交

- [ ] **步骤 4: 创建功能总结文档（可选）**

创建 `docs/superpowers/summaries/2026-03-27-onlyoffice-spellcheck-disabled.md`：

```markdown
# OnlyOffice 拼写检查默认关闭功能 - 实现总结

**实现日期:** 2026-03-27
**状态:** ✅ 完成

## 实现的功能

1. **动态 localStorage 清除**: 使用模式匹配扫描并清除拼写检查缓存
2. **默认关闭拼写检查**: 通过 `features.spellcheck: false` 配置强制关闭
3. **完善的错误处理**: 支持隐私模式、localStorage 禁用等场景
4. **详细日志记录**: 便于调试和问题追踪

## 关键实现

- **文件:** `src/components/OnlyOfficeEditor.vue`
- **函数:** `clearSpellcheckCache()`
- **配置:** `editorConfig.customization.features.spellcheck: false`

## 测试覆盖

- ✅ 基本功能测试（默认关闭、刷新保持、缓存重置）
- ✅ 本地存储测试（缓存清除、模式匹配）
- ✅ 跨文档类型测试（word, cell, slide）
- ✅ 边界情况测试（隐私模式、性能、多标签页）

## 已知限制

- 多实例场景下，每个实例都会清除缓存（符合预期行为）
- 如果 OnlyOffice 版本升级导致键名变化，模式匹配会自动适应

## 相关文档

- 设计文档: `docs/superpowers/specs/2026-03-27-onlyoffice-spellcheck-disabled-design.md`
- 实现计划: `docs/superpowers/plans/2026-03-27-onlyoffice-spellcheck-disabled.md`
```

- [ ] **步骤 5: 提交总结文档**

```bash
git add docs/superpowers/summaries/2026-03-27-onlyoffice-spellcheck-disabled.md
git commit -m "docs: 添加 OnlyOffice 拼写检查功能实现总结"
```

---

## 附录

### A. 相关文件路径

- **组件文件**: `src/components/OnlyOfficeEditor.vue`
- **类型定义**: `src/types/onlyoffice.d.ts`
- **日志工具**: `src/utils/logger.ts`
- **设计文档**: `docs/superpowers/specs/2026-03-27-onlyoffice-spellcheck-disabled-design.md`

### B. 测试命令

```bash
# 类型检查
pnpm type-check

# 开发服务器
pnpm dev

# 构建测试
pnpm build

# 预览构建结果
pnpm preview
```

### C. 浏览器开发者工具使用

**检查 localStorage:**
1. 打开开发者工具 (F12)
2. 导航到 Application > Local Storage
3. 查看和修改 localStorage 键值对

**查看控制台日志:**
1. 打开开发者工具 (F12)
2. 导航到 Console 标签
3. 查找 `[Demo Office]` 前缀的日志

**手动测试拼写检查:**
1. 在编辑器中输入拼写错误的单词
2. 观察是否出现红色波浪线
3. 使用 DOM 检查器查找 `.squiggle` 类名的元素

### D. 故障排查

**问题:** 清除操作不生效

**排查步骤:**
1. 检查控制台是否有错误日志
2. 验证 localStorage 中是否存在拼写检查相关的键
3. 手动添加测试键，刷新页面验证是否被清除
4. 在 `clearSpellcheckCache` 中添加断点，调试执行流程

**问题:** 隐私模式下报错

**预期行为:** 应该显示 "localStorage 不可写" 警告，但不影响编辑器功能

**解决:** 检查错误处理代码，确保所有 localStorage 操作都被 try-catch 包裹

**问题:** 类型检查失败

**解决:** 确保 `src/types/onlyoffice.d.ts` 中的类型定义与 `src/components/OnlyOfficeEditor.vue` 中的使用一致

### E. 性能优化建议

如果清除操作超过 10ms，可以考虑：
1. 优化模式匹配算法
2. 减少不必要的字符串操作
3. 使用更高效的正则表达式

当前实现已满足性能要求（< 10ms），一般不需要优化。
