# OnlyOffice 拼写检查默认关闭功能设计文档

**日期**: 2026-03-27
**状态**: 设计阶段
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

1. **默认关闭拼写检查**：通过配置将拼写检查设置为默认关闭
2. **清除缓存状态**：每次编辑器初始化前清除 localStorage 中的拼写检查缓存
3. **保证一致性**：确保每次加载编辑器时拼写检查都是关闭状态

## 4. 技术方案

### 4.1 方案选择

选择**组件内部处理方案**：
- 修改集中在 `OnlyOfficeEditor.vue` 组件内
- 不影响其他组件
- 简单直接，易于维护

### 4.2 实现细节

#### 4.2.1 清除本地存储缓存

在组件挂载时，使用 `onMounted` 钩子清除拼写检查相关的 localStorage：

```typescript
onMounted(() => {
  const spellcheckKeys = [
    'onlyoffice-spellcheck',
    'asc-spellcheck',
    'spellcheck-enabled'
  ]

  spellcheckKeys.forEach(key => {
    localStorage.removeItem(key)
  })

  logger.log('✅ 已清除 OnlyOffice 拼写检查缓存')
})
```

**说明**：OnlyOffice 可能使用不同的 localStorage 键名，如果上述键名不生效，需要通过浏览器开发者工具检查实际使用的键名并更新。

#### 4.2.2 配置拼写检查功能

在 `config` computed 中的 `editorConfig.customization` 添加 `features` 配置：

```typescript
customization: {
  uiTheme: props.uiTheme || 'theme-light',
  features: {
    spellcheck: false
  }
}
```

**配置选项**：
- `spellcheck: false` - 完全禁用拼写检查（布尔值）
- `spellcheck: { mode: false }` - 对象形式，仅适用于文档编辑器和演示编辑器

#### 4.2.3 更新 TypeScript 类型定义

修改 `src/types/onlyoffice.d.ts`，扩展 `customization` 接口：

```typescript
customization?: {
  uiTheme?: OnlyOfficeUiTheme
  features?: {
    spellcheck?: boolean | {
      mode?: boolean
    }
  }
}
```

### 4.3 数据流

```
组件挂载 (onMounted)
    ↓
清除 localStorage 中的拼写检查缓存
    ↓
创建 config 对象（包含 features.spellcheck: false）
    ↓
OnlyOffice 初始化（使用关闭的拼写检查）
```

## 5. 文件变更清单

1. **src/components/OnlyOfficeEditor.vue**
   - 导入 `onMounted` 从 Vue
   - 添加 `onMounted` 钩子，清除 localStorage
   - 更新 `config` computed 中的 `customization` 对象

2. **src/types/onlyoffice.d.ts**
   - 扩展 `customization` 接口，添加 `features` 属性定义

## 6. 测试计划

### 6.1 功能测试

1. **基本功能测试**
   - 加载编辑器，确认拼写检查默认关闭
   - 刷新页面，确认状态保持关闭
   - 在编辑器中手动开启拼写检查
   - 刷新页面，确认状态重置为关闭

2. **本地存储测试**
   - 打开浏览器开发者工具 > Application > Local Storage
   - 验证编辑器加载后拼写检查相关的键被清除
   - 手动设置拼写检查缓存，刷新页面验证被清除

3. **跨文档类型测试**
   - 测试文档编辑器（word）
   - 测试表格编辑器（cell）
   - 测试演示编辑器（slide）

### 6.2 兼容性测试

- 验证在不同浏览器中清除 localStorage 的功能正常（Chrome, Firefox, Safari, Edge）

## 7. 风险与注意事项

### 7.1 风险

1. **localStorage 键名不确定性**
   - OnlyOffice 可能使用不同的键名存储拼写检查状态
   - 缓解措施：通过浏览器开发者工具检查实际键名，必要时更新键名列表

2. **用户偏好丢失**
   - 如果用户真的想要启用拼写检查，每次刷新都会被重置
   - 这是预期行为，符合需求

### 7.2 注意事项

1. `features.spellcheck` 设置为 `false` 会完全禁用拼写检查功能
2. 如果需要更细粒度的控制，可以使用对象形式：`{ spellcheck: { mode: false } }`
3. 确保在 OnlyOffice 初始化之前清除 localStorage

## 8. 后续优化建议

1. **配置化键名管理**：如果发现更多 localStorage 键名，可以提取到配置文件中
2. **日志记录**：记录清除操作的详细信息，便于调试
3. **用户配置**：如果将来需要支持用户自定义拼写检查状态，可以添加用户偏好设置

## 9. 参考资料

- OnlyOffice 官方文档：`features.spellcheck` 配置
- OnlyOffice 官方文档：`features.spellcheck.mode` 配置
- 浏览器 localStorage API
