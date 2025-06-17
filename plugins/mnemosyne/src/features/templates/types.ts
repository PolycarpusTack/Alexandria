export interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  metadata?: Record<string, any>;
}

export interface TemplateContext {
  [key: string]: any;
  mnemosyne?: {
    id: string;
    version: string;
    created: string;
    updated: string;
    document: any;
    related: any[];
    userProfile: any;
    insights: any;
  };
  alexandria?: any;
}

export interface RenderOptions {
  escapeHtml?: boolean;
  strict?: boolean;
  helpers?: Record<string, Function>;
}