<script setup lang="ts">
import { computed, ref } from "vue";
import OnlyOfficeEditor from "@/components/OnlyOfficeEditor.vue";
import { validateFile, uploadFile } from "@/utils/fileHelper";
import { logger } from "@/utils/logger";

const DOCUMENT_SERVER_URL = import.meta.env.VITE_ONLYOFFICE_URL;

if (!DOCUMENT_SERVER_URL) {
  throw new Error(
    "环境变量 VITE_ONLYOFFICE_URL 未配置。请在 .env.local 中配置，例如：VITE_ONLYOFFICE_URL=http://localhost:80",
  );
}

type TabMode = "view" | "edit" | "compare";

interface UploadedDoc {
  file: File;
  url: string;
  uploadedAt: number;
}

interface OnlyOfficeEditorExpose {
  startCompare: () => boolean;
}

const activeTab = ref<TabMode>("view");
const isUploading = ref(false);
const errorMessage = ref("");
const statusMessage = ref("");

const viewDoc = ref<UploadedDoc | null>(null);
const editDoc = ref<UploadedDoc | null>(null);
const compareBaseDoc = ref<UploadedDoc | null>(null);
const compareRevisedDoc = ref<UploadedDoc | null>(null);

const compareEditorRef = ref<OnlyOfficeEditorExpose | null>(null);
const compareEditorReady = ref(false);
const lastComparedBaseUploadedAt = ref<number | null>(null);

const communityCompareNotice =
  "OnlyOffice 社区版通常不包含文档比较授权（该能力主要在企业版/开发者版）。本 demo 已按官方 API 方式接入，如果无授权会在编辑器内提示失败。";

const canStartCompare = computed(
  () =>
    !!compareBaseDoc.value &&
    !!compareRevisedDoc.value &&
    compareEditorReady.value &&
    lastComparedBaseUploadedAt.value !== compareBaseDoc.value.uploadedAt,
);

const compareButtonText = computed(() => {
  if (!compareBaseDoc.value || !compareRevisedDoc.value) return "请先上传两个文档";
  if (!compareEditorReady.value) return "编辑器加载中...";
  if (lastComparedBaseUploadedAt.value === compareBaseDoc.value.uploadedAt) {
    return "已比较，请重传基准文档";
  }
  return "开始比较";
});

const toAbsoluteUrl = (path: string) => `${window.location.origin}${path}`;
const createVirtualFile = (name: string) => new File([], name);

const setTab = (tab: TabMode) => {
  activeTab.value = tab;
  errorMessage.value = "";
  statusMessage.value = "";
  if (tab !== "compare") {
    compareEditorReady.value = false;
  }
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

const onCompareBaseChange = async (event: Event) => {
  const uploaded = await uploadByInputEvent(event);
  if (!uploaded) return;

  compareBaseDoc.value = uploaded;
  lastComparedBaseUploadedAt.value = null;
  compareEditorReady.value = false;
  statusMessage.value = `已加载基准文档：${uploaded.file.name}`;
};

const onCompareRevisedChange = async (event: Event) => {
  const uploaded = await uploadByInputEvent(event);
  if (!uploaded) return;

  compareRevisedDoc.value = uploaded;
  compareEditorReady.value = false;
  statusMessage.value = `已加载对比文档：${uploaded.file.name}`;
};

const loadViewSample = () => {
  viewDoc.value = {
    file: createVirtualFile("demo.docx"),
    url: "https://static.onlyoffice.com/assets/docs/samples/demo.docx",
    uploadedAt: Date.now(),
  };
  statusMessage.value = "已加载 OnlyOffice 官方公开示例文档";
};

const loadCompareSample = () => {
  compareBaseDoc.value = {
    file: createVirtualFile("old.docx"),
    url: toAbsoluteUrl("/temp/old.docx"),
    uploadedAt: Date.now(),
  };

  compareRevisedDoc.value = {
    file: createVirtualFile("new.docx"),
    url: toAbsoluteUrl("/temp/new.docx"),
    uploadedAt: Date.now(),
  };

  lastComparedBaseUploadedAt.value = null;
  compareEditorReady.value = false;
  statusMessage.value = "已加载本地示例 old.docx / new.docx";
};

const onCompareEditorReady = () => {
  compareEditorReady.value = true;
};

const startCompare = () => {
  if (!compareBaseDoc.value || !compareRevisedDoc.value) {
    errorMessage.value = "请先上传两个 docx 文件";
    return;
  }

  if (!compareEditorReady.value) {
    errorMessage.value = "编辑器还未加载完成，请稍后再试";
    return;
  }

  if (lastComparedBaseUploadedAt.value === compareBaseDoc.value.uploadedAt) {
    errorMessage.value = "";
    statusMessage.value =
      "当前基准文档已经比较过。如需再次比较，请重新上传基准文档。";
    return;
  }

  const ok = compareEditorRef.value?.startCompare();
  if (ok) {
    lastComparedBaseUploadedAt.value = compareBaseDoc.value.uploadedAt;
    errorMessage.value = "";
    statusMessage.value =
      "已触发文档比较。当前基准文档已锁定，重新上传基准文档后可再次比较。";
  }
};

const onEditorError = (message: string) => {
  errorMessage.value = message;
};
</script>

<template>
  <div class="office-page">
    <header class="header">
      <h1>Custom Office Demo（OnlyOffice API）</h1>
      <p>自建 UI + OnlyOffice API：查看、编辑、文档比较</p>
    </header>

    <section class="toolbar">
      <div class="tabs">
        <button
          :class="{ active: activeTab === 'view' }"
          @click="setTab('view')"
        >
          查看
        </button>
        <button
          :class="{ active: activeTab === 'edit' }"
          @click="setTab('edit')"
        >
          编辑
        </button>
        <button
          :class="{ active: activeTab === 'compare' }"
          @click="setTab('compare')"
        >
          比较
        </button>
      </div>

      <div class="actions" v-if="activeTab === 'view'">
        <button class="ghost" @click="loadViewSample">加载官方示例</button>
        <input
          type="file"
          accept=".docx,.pdf,.xlsx,.pptx"
          :disabled="isUploading"
          @change="onViewFileChange"
        />
      </div>

      <div class="actions" v-if="activeTab === 'edit'">
        <input
          type="file"
          accept=".docx,.xlsx,.pptx"
          :disabled="isUploading"
          @change="onEditFileChange"
        />
      </div>

      <div class="actions compare-actions" v-if="activeTab === 'compare'">
        <button class="ghost" @click="loadCompareSample">加载本地示例</button>
        <label>
          基准文档
          <input
            type="file"
            accept=".docx"
            :disabled="isUploading"
            @change="onCompareBaseChange"
          />
        </label>
        <label>
          对比文档
          <input
            type="file"
            accept=".docx"
            :disabled="isUploading"
            @change="onCompareRevisedChange"
          />
        </label>
        <button :disabled="!canStartCompare" @click="startCompare">
          {{ compareButtonText }}
        </button>
      </div>
    </section>

    <section class="notice" v-if="activeTab === 'compare'">
      {{ communityCompareNotice }}
    </section>

    <section class="status">
      <span v-if="isUploading">上传中...</span>
      <span v-else-if="errorMessage" class="error">{{ errorMessage }}</span>
      <span v-else-if="statusMessage">{{ statusMessage }}</span>
      <span v-else>请选择文件开始</span>
    </section>

    <section class="editor-wrap">
      <template v-if="activeTab === 'view'">
        <OnlyOfficeEditor
          v-if="viewDoc"
          editor-id="view-editor"
          :documentServerUrl="DOCUMENT_SERVER_URL"
          :file-url="viewDoc.url"
          :file="viewDoc.file"
          mode="view"
          :is-public-url="viewDoc.url.startsWith('https://')"
          @error="onEditorError"
        />
        <div v-else class="empty">
          <p>请选择文件以加载编辑器。</p>
        </div>
      </template>

      <template v-if="activeTab === 'edit'">
        <OnlyOfficeEditor
          v-if="editDoc"
          editor-id="edit-editor"
          :documentServerUrl="DOCUMENT_SERVER_URL"
          :file-url="editDoc.url"
          :file="editDoc.file"
          mode="edit"
          @error="onEditorError"
        />
        <div v-else class="empty">
          <p>请选择文件以加载编辑器。</p>
        </div>
      </template>

      <template v-if="activeTab === 'compare'">
        <OnlyOfficeEditor
          v-if="compareBaseDoc && compareRevisedDoc"
          ref="compareEditorRef"
          editor-id="compare-editor"
          :documentServerUrl="DOCUMENT_SERVER_URL"
          :file-url="compareBaseDoc.url"
          :file="compareBaseDoc.file"
          :revised-file-url="compareRevisedDoc.url"
          :revised-file="compareRevisedDoc.file"
          mode="compare"
          @document-ready="onCompareEditorReady"
          @error="onEditorError"
        />
        <div v-else class="empty">
          <p>请先上传“基准文档”和“对比文档”，然后点击“开始比较”。</p>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.office-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.header {
  padding: 16px 20px 8px;
}

.header h1 {
  margin: 0;
  font-size: 20px;
}

.header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #475467;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  background: #ffffff;
  border-top: 1px solid #eaecf0;
  border-bottom: 1px solid #eaecf0;
}

.tabs {
  display: flex;
  gap: 8px;
}

button {
  border: 1px solid #d0d5dd;
  background: #ffffff;
  color: #1d2939;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

button.active {
  background: #175cd3;
  border-color: #175cd3;
  color: #ffffff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.ghost {
  background: #eef4ff;
  border-color: #c7d7fe;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.compare-actions label {
  font-size: 12px;
  color: #344054;
  display: grid;
  gap: 4px;
}

.notice {
  margin: 10px 20px 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fffaeb;
  border: 1px solid #fedf89;
  color: #7a2e0e;
  font-size: 12px;
}

.status {
  padding: 10px 20px;
  font-size: 13px;
  color: #475467;
}

.status .error {
  color: #d92d20;
}

.editor-wrap {
  flex: 1;
  min-height: 0;
  margin: 0 20px 20px;
  border: 1px solid #d0d5dd;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
}

.empty {
  height: 100%;
  display: grid;
  place-items: center;
  color: #667085;
  text-align: center;
  padding: 16px;
}
</style>
