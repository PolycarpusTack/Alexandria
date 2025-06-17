import { HTTPMethods, ContentTypes, AuthTypes } from '../constants.js';

export class RequestBuilder {
  constructor(plugin) {
    this.plugin = plugin;
    this.request = {
      method: 'GET',
      url: '',
      headers: {},
      params: {},
      body: null,
      auth: { type: AuthTypes.NONE }
    };
  }

  setMethod(method) {
    this.request.method = method;
  }

  setUrl(url) {
    this.request.url = url;
    this.parseUrlParams(url);
  }

  parseUrlParams(url) {
    try {
      const urlObj = new URL(url);
      const params = {};
      
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      
      this.request.params = params;
    } catch (error) {
      // Invalid URL, ignore
    }
  }
  addHeader(key, value) {
    if (key && value) {
      this.request.headers[key] = value;
    }
  }

  removeHeader(key) {
    delete this.request.headers[key];
  }

  addParam(key, value) {
    if (key) {
      this.request.params[key] = value;
    }
  }

  removeParam(key) {
    delete this.request.params[key];
  }

  setBody(body, contentType) {
    this.request.body = body;
    
    if (contentType) {
      this.addHeader('Content-Type', contentType);
    }
  }

  setAuth(authType, credentials) {
    this.request.auth = {
      type: authType,
      credentials
    };
    
    // Apply auth headers based on type
    switch (authType) {
      case AuthTypes.BEARER:
        this.addHeader('Authorization', `Bearer ${credentials.token}`);
        break;
      case AuthTypes.BASIC:
        const encoded = btoa(`${credentials.username}:${credentials.password}`);
        this.addHeader('Authorization', `Basic ${encoded}`);
        break;
      case AuthTypes.API_KEY:
        if (credentials.addTo === 'header') {
          this.addHeader(credentials.key, credentials.value);
        }
        break;
    }
  }

  build() {
    return { ...this.request };
  }
}