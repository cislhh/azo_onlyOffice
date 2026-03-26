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
    customization?: {
      uiTheme?: OnlyOfficeUiTheme
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
