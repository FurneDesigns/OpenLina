export interface TemplateFile {
  path: string
  content: string
}

export interface Template {
  id: string
  name: string
  description: string
  framework: string
  files: TemplateFile[]
}
