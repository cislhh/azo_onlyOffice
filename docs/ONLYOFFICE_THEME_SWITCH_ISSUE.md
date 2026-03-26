# OnlyOffice 主题切换异常复盘

## 现象
- 默认浅色正常。
- 切换深色时界面不变。
- 控制台报错：`TypeError: Cannot read properties of null (reading 'postMessage')`（`content_script.js`）。

## 实际问题（根因）
- 主题切换时引入了**动态 `key` + 动态 `editor-id`**，导致 `OnlyOfficeEditor` 被强制卸载并重建。
- 同时，`@onlyoffice/document-editor-vue` 在 `config` 变化时本身也会执行 `destroyEditor() -> onLoad()`。
- 两套重建机制叠加后出现竞态：旧 iframe 已销毁但仍有消息发送，触发 `postMessage` 对 `null` 调用；新实例加载过程被干扰，表现为主题不生效。

## 修复方案
- 移除动态 `key` 和动态 `editor-id`，保持编辑器实例稳定。
- 仅通过配置更新主题：`editorConfig.customization.uiTheme`。
- 当前使用：`theme-light` / `theme-dark`，默认 `theme-light`。

## 结论
- 本次问题的关键不在 `v-if` 与 `else-if` 的写法本身，而在于**额外强制重挂载**导致的实例生命周期冲突。
- 对 OnlyOffice 这类 iframe 编辑器，优先保持实例稳定，避免手动 remount。
