export type OnlyOfficeUiTheme =
  | 'theme-light'
  | 'theme-dark'
  | 'theme-classic-light'
  | 'theme-contrast-dark'
  | 'theme-white'
  | 'theme-night'
  | 'default-light'
  | 'default-dark'

export interface OnlyOfficeConfig {
  document: {
    fileType: string
    key: string
    title: string
    url: string
    permissions?: {
      edit?: boolean
      review?: boolean
      download?: boolean
      print?: boolean
    }
  }
  documentType: 'word' | 'cell' | 'slide'
  editorConfig: {
    mode: 'edit' | 'view' | 'review'
    callbackUrl?: string  // 可选，编辑模式需要
    lang: string
    plugins?: {
      autostart?: string[]
      pluginsData?: string[]
      url?: string
      options?: {
        all?: object
        pluginGuid: object
      }
    }
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
    user?: {
      id: string
      name: string
    }
  }
  token?: string  // JWT token（如果启用）
}

export interface SaveAsEvent {
  data: {
    title: string
    url: string
    fileType: string
  }
}

export interface ComponentErrorEvent {
  errorCode: number
  errorDescription: string
}

export interface OnlyOfficeEvents {
  onDocumentReady: () => void
  onLoadComponentError: (event: ComponentErrorEvent) => void
  onRequestSaveAs?: (event: SaveAsEvent) => void
  onRequestCompareFile?: () => void
  onDocumentStateChange?: (event: { data: boolean }) => void
}
