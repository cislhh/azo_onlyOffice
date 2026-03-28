<script setup lang="ts">
import { ref } from "vue";
import OnlyOfficeEditor from "@/components/OnlyOfficeEditor.vue";
import { validateFile, uploadFile } from "@/utils/fileHelper";
import { logger } from "@/utils/logger";

const DOCUMENT_SERVER_URL = import.meta.env.VITE_ONLYOFFICE_URL;

if (!DOCUMENT_SERVER_URL) {
  throw new Error(
    "环境变量 VITE_ONLYOFFICE_URL 未配置。请在 .env.local 中配置，例如：VITE_ONLYOFFICE_URL=http://localhost:80",
  );
}

type TabMode = "view" | "edit";
type UiTheme = "theme-light" | "theme-dark";

interface UploadedDoc {
  file: File;
  url: string;
  uploadedAt: number;
}

const activeTab = ref<TabMode>("view");
const uiTheme = ref<UiTheme>("theme-light");
const isUploading = ref(false);
const errorMessage = ref("");
const statusMessage = ref("");

const viewDoc = ref<UploadedDoc | null>(null);
const editDoc = ref<UploadedDoc | null>(null);

const setTab = (tab: TabMode) => {
  activeTab.value = tab;
  errorMessage.value = "";
  statusMessage.value = "";
};

const setUiTheme = (theme: UiTheme) => {
  if (uiTheme.value === theme) return;
  uiTheme.value = theme;
};

const uploadByInputEvent = async (
  event: Event,
): Promise<UploadedDoc | null> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return null;

  const validation = validateFile(file);
  if (!validation.valid) {
    errorMessage.value = validation.error || "文件不合法";
    return null;
  }

  isUploading.value = true;
  errorMessage.value = "";

  try {
    const url = await uploadFile(file);
    logger.log("文件上传完成:", file.name, url);
    return { file, url, uploadedAt: Date.now() };
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "文件上传失败";
    return null;
  } finally {
    isUploading.value = false;
  }
};

const onViewFileChange = async (event: Event) => {
  const uploaded = await uploadByInputEvent(event);
  if (!uploaded) return;

  viewDoc.value = uploaded;
  statusMessage.value = `已加载查看文档：${uploaded.file.name}`;
};

const onEditFileChange = async (event: Event) => {
  const uploaded = await uploadByInputEvent(event);
  if (!uploaded) return;

  editDoc.value = uploaded;
  statusMessage.value = `已加载编辑文档：${uploaded.file.name}`;
};

const loadViewSample = () => {
  viewDoc.value = {
    file: new File([], "demo.docx"),
    url: "https://static.onlyoffice.com/assets/docs/samples/demo.docx",
    uploadedAt: Date.now(),
  };
  statusMessage.value = "已加载 OnlyOffice 官方公开示例文档";
};

const onEditorError = (message: string) => {
  errorMessage.value = message;
};

</script>

<template>
  <div class="office-page">
    <!-- Header -->
    <header class="layout-header">
      <div class="header-content">
        <div class="header-left">
          <svg
            class="logo-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div class="header-titles">
            <h1 class="header-title">OnlyOffice 文档编辑器</h1>
          </div>
        </div>
        <div class="header-right">
          <div class="theme-switch" role="group" aria-label="编辑器主题切换">
            <button
              type="button"
              class="theme-button"
              :class="{ active: uiTheme === 'theme-light' }"
              @click="setUiTheme('theme-light')"
            >
              浅色
            </button>
            <button
              type="button"
              class="theme-button"
              :class="{ active: uiTheme === 'theme-dark' }"
              @click="setUiTheme('theme-dark')"
            >
              深色
            </button>
          </div>
          <span v-if="isUploading" class="status-text uploading"
            >上传中...</span
          >
          <span v-else-if="errorMessage" class="status-text error">{{
            errorMessage
          }}</span>
          <span v-else-if="statusMessage" class="status-text success">{{
            statusMessage
          }}</span>
          <span v-else class="status-text idle">请选择文件开始</span>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <div class="layout-main">
      <!-- Sidebar -->
      <aside class="layout-sidebar">
        <nav class="sidebar-nav">
          <div class="nav-section">
            <h3 class="nav-section-title">工作模式</h3>
            <button
              class="nav-button"
              :class="{ active: activeTab === 'view' }"
              @click="setTab('view')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span>查看模式</span>
            </button>

            <button
              class="nav-button"
              :class="{ active: activeTab === 'edit' }"
              @click="setTab('edit')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>编辑模式</span>
            </button>

          </div>

          <div class="nav-section" v-if="activeTab === 'view'">
            <h3 class="nav-section-title">文件操作</h3>
            <button
              class="nav-button nav-button-action"
              @click="loadViewSample"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>加载官方示例</span>
            </button>
            <label class="nav-button nav-button-upload">
              <input
                type="file"
                accept=".docx,.pdf,.xlsx,.pptx"
                :disabled="isUploading"
                @change="onViewFileChange"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>上传文件</span>
            </label>
          </div>

          <div class="nav-section" v-if="activeTab === 'edit'">
            <h3 class="nav-section-title">文件操作</h3>
            <label class="nav-button nav-button-upload">
              <input
                type="file"
                accept=".docx,.pdf,.xlsx,.pptx"
                :disabled="isUploading"
                @change="onEditFileChange"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>上传文件</span>
            </label>
          </div>

        </nav>

        <div class="sidebar-footer">
          <div
            class="status-indicator"
            :class="{
              online: viewDoc || editDoc,
            }"
          >
            <span class="status-dot"></span>
            <span class="status-text">{{
              viewDoc || editDoc ? "编辑器就绪" : "等待加载"
            }}</span>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="layout-content">
        <div class="editor-wrap">
          <template v-if="activeTab === 'view'">
            <OnlyOfficeEditor
              v-if="viewDoc"
              editor-id="view-editor"
              :documentServerUrl="DOCUMENT_SERVER_URL"
              :file-url="viewDoc.url"
              :file="viewDoc.file"
              :ui-theme="uiTheme"
              mode="view"
              :is-public-url="viewDoc.url.startsWith('https://')"
              @error="onEditorError"
            />
            <div v-else class="empty-state">
              <svg
                class="empty-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p class="empty-text">请选择文件开始查看</p>
              <p class="empty-hint">支持 .docx, .pdf, .xlsx, .pptx 等格式</p>
            </div>
          </template>

          <template v-if="activeTab === 'edit'">
            <OnlyOfficeEditor
              v-if="editDoc"
              editor-id="edit-editor"
              :documentServerUrl="DOCUMENT_SERVER_URL"
              :file-url="editDoc.url"
              :file="editDoc.file"
              :ui-theme="uiTheme"
              mode="edit"
              @error="onEditorError"
            />
            <div v-else class="empty-state">
              <svg
                class="empty-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <p class="empty-text">请选择文件开始编辑</p>
              <p class="empty-hint">支持 .docx, .pdf, .xlsx, .pptx 等格式</p>
            </div>
          </template>

        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Layout Grid System */
.office-page {
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr;
  height: 100vh;
  background-color: #0f172a;
  color: #f8fafc;
  font-family:
    "Fira Sans",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;
}

/* Header Styles */
.layout-header {
  grid-row: 1;
  background-color: #1e293b;
  border-bottom: 1px solid #334155;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 72px;
  max-width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  color: #22c55e;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0;
}

.header-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-switch {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid #334155;
  background-color: #0f172a;
}

.theme-button {
  border: 0;
  background: transparent;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-button:hover {
  color: #f8fafc;
}

.theme-button.active {
  background-color: #22c55e;
  color: #052e16;
}

.theme-button:focus-visible {
  outline: 2px solid #22c55e;
  outline-offset: 1px;
}

.status-text {
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  white-space: nowrap;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-text.uploading {
  color: #60a5fa;
  background-color: rgba(96, 165, 250, 0.1);
}

.status-text.error {
  color: #f87171;
  background-color: rgba(248, 113, 113, 0.1);
}

.status-text.success {
  color: #4ade80;
  background-color: rgba(74, 222, 128, 0.1);
}

.status-text.idle {
  color: #94a3b8;
  background-color: rgba(148, 163, 184, 0.1);
}

/* Main Content Area */
.layout-main {
  grid-row: 2;
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: 1fr;
  overflow: hidden;
}

/* Sidebar Styles */
.layout-sidebar {
  grid-column: 1;
  background-color: #1e293b;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: auto;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 4px 0;
  padding: 8px 12px 4px;
}

.nav-button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.nav-button:hover {
  background-color: #334155;
  color: #f8fafc;
}

.nav-button:focus {
  outline: 2px solid #22c55e;
  outline-offset: 2px;
}

.nav-button.active {
  background-color: #22c55e;
  color: #0f172a;
  border-color: #22c55e;
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-button svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-button-action {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #0f172a;
  font-weight: 600;
}

.nav-button-action:hover {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  color: #0f172a;
}

.nav-button-upload {
  position: relative;
}

.nav-button-upload input[type="file"] {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.nav-button-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  font-weight: 600;
}

.nav-button-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #334155;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-box {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: #451a03;
  border: 1px solid #92400e;
  border-radius: 8px;
  color: #fcd34d;
  font-size: 12px;
  line-height: 1.5;
}

.notice-box svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.notice-box p {
  margin: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: #334155;
  border-radius: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ef4444;
  animation: pulse 2s ease-in-out infinite;
}

.status-indicator.online .status-dot {
  background-color: #22c55e;
  animation: none;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-size: 12px;
  color: #cbd5e1;
  font-weight: 500;
}

/* Main Content Styles */
.layout-content {
  grid-column: 2;
  background-color: #0f172a;
  overflow: hidden;
  position: relative;
}

.editor-wrap {
  height: 100%;
  width: 100%;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #64748b;
}

.empty-icon {
  width: 96px;
  height: 96px;
  opacity: 0.4;
}

.empty-text {
  font-size: 18px;
  font-weight: 500;
  color: #94a3b8;
  margin: 0;
}

.empty-hint {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .layout-main {
    grid-template-columns: 80px 1fr;
  }

  .nav-button span,
  .nav-section-title,
  .header-subtitle {
    display: none;
  }

  .sidebar-nav {
    padding: 12px 8px;
  }

  .nav-button {
    padding: 12px;
    justify-content: center;
  }

  .header-content {
    padding: 0 16px;
    height: 64px;
  }
}

@media (max-width: 768px) {
  .layout-main {
    grid-template-columns: 1fr;
  }

  .layout-sidebar {
    display: none;
  }

  .header-content {
    padding: 0 12px;
    height: 56px;
  }

  .theme-button {
    padding: 6px 10px;
  }

  .logo-icon {
    width: 32px;
    height: 32px;
  }

  .header-title {
    font-size: 16px;
  }

  .status-badge {
    padding: 8px 12px;
    font-size: 12px;
  }

  .status-badge span {
    display: none;
  }
}

/* Scrollbar Styling */
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: #1e293b;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
