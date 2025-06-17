export class CodeGenerator {
  constructor(plugin) {
    this.plugin = plugin;
    this.languages = [
      { id: 'javascript', name: 'JavaScript (Fetch)', icon: 'fa-brands fa-js' },
      { id: 'python', name: 'Python (Requests)', icon: 'fa-brands fa-python' },
      { id: 'curl', name: 'cURL', icon: 'fa-solid fa-terminal' },
      { id: 'nodejs', name: 'Node.js (Axios)', icon: 'fa-brands fa-node' },
      { id: 'php', name: 'PHP', icon: 'fa-brands fa-php' },
      { id: 'go', name: 'Go', icon: 'fa-solid fa-code' },
      { id: 'java', name: 'Java (OkHttp)', icon: 'fa-brands fa-java' },
      { id: 'csharp', name: 'C# (HttpClient)', icon: 'fa-solid fa-code' }
    ];
  }

  generate(request, language) {
    const generators = {
      javascript: this.generateJavaScript,
      python: this.generatePython,
      curl: this.generateCurl,
      nodejs: this.generateNodeJS,
      php: this.generatePHP,
      go: this.generateGo,
      java: this.generateJava,
      csharp: this.generateCSharp
    };

    const generator = generators[language];
    return generator ? generator.call(this, request) : 'Language not supported';
  }
  generateJavaScript(request) {
    const { method, url, headers, body } = request;
    
    let code = `fetch('${url}', {\n`;
    code += `  method: '${method}',\n`;
    
    if (headers && Object.keys(headers).length > 0) {
      code += `  headers: ${JSON.stringify(headers, null, 4)},\n`;
    }
    
    if (body) {
      code += `  body: JSON.stringify(${JSON.stringify(body, null, 4)})\n`;
    }
    
    code += `})\n`;
    code += `.then(response => response.json())\n`;
    code += `.then(data => console.log(data))\n`;
    code += `.catch(error => console.error('Error:', error));`;
    
    return code;
  }

  generatePython(request) {
    const { method, url, headers, body } = request;
    
    let code = `import requests\n\n`;
    code += `url = "${url}"\n`;    
    if (headers && Object.keys(headers).length > 0) {
      code += `headers = ${JSON.stringify(headers, null, 2).replace(/"/g, "'")}\n`;
    }
    
    if (body) {
      code += `data = ${JSON.stringify(body, null, 2).replace(/"/g, "'")}\n\n`;
      code += `response = requests.${method.toLowerCase()}(url, headers=headers, json=data)\n`;
    } else {
      code += `\nresponse = requests.${method.toLowerCase()}(url${headers ? ', headers=headers' : ''})\n`;
    }
    
    code += `print(response.json())`;
    
    return code;
  }

  generateCurl(request) {
    const { method, url, headers, body } = request;
    
    let code = `curl -X ${method} '${url}'`;
    
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        code += ` \\\n  -H '${key}: ${value}'`;
      });
    }
    
    if (body) {
      code += ` \\\n  -d '${JSON.stringify(body)}'`;
    }
    
    return code;
  }
  
  generateNodeJS(request) {
    const { method, url, headers, body } = request;
    
    let code = `const axios = require('axios');\n\n`;
    code += `const config = {\n`;
    code += `  method: '${method.toLowerCase()}',\n`;
    code += `  url: '${url}',\n`;
    
    if (headers && Object.keys(headers).length > 0) {
      code += `  headers: ${JSON.stringify(headers, null, 4)},\n`;
    }
    
    if (body) {
      code += `  data: ${JSON.stringify(body, null, 4)}\n`;
    }
    
    code += `};\n\n`;
    code += `axios(config)\n`;
    code += `  .then(response => {\n`;
    code += `    console.log(JSON.stringify(response.data));\n`;
    code += `  })\n`;
    code += `  .catch(error => {\n`;
    code += `    console.error(error);\n`;
    code += `  });`;
    
    return code;
  }
  
  generatePHP(request) {
    const { method, url, headers, body } = request;
    
    let code = `<?php\n\n`;
    code += `$curl = curl_init();\n\n`;
    code += `curl_setopt_array($curl, array(\n`;
    code += `  CURLOPT_URL => '${url}',\n`;
    code += `  CURLOPT_RETURNTRANSFER => true,\n`;
    code += `  CURLOPT_ENCODING => '',\n`;
    code += `  CURLOPT_MAXREDIRS => 10,\n`;
    code += `  CURLOPT_TIMEOUT => 0,\n`;
    code += `  CURLOPT_FOLLOWLOCATION => true,\n`;
    code += `  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n`;
    code += `  CURLOPT_CUSTOMREQUEST => '${method}',\n`;
    
    if (body) {
      code += `  CURLOPT_POSTFIELDS => '${JSON.stringify(body)}',\n`;
    }
    
    if (headers && Object.keys(headers).length > 0) {
      code += `  CURLOPT_HTTPHEADER => array(\n`;
      Object.entries(headers).forEach(([key, value]) => {
        code += `    '${key}: ${value}',\n`;
      });
      code += `  ),\n`;
    }
    
    code += `));\n\n`;
    code += `$response = curl_exec($curl);\n`;
    code += `curl_close($curl);\n`;
    code += `echo $response;\n`;
    code += `?>`;
    
    return code;
  }
  
  generateGo(request) {
    const { method, url, headers, body } = request;
    
    let code = `package main\n\n`;
    code += `import (\n`;
    code += `    "fmt"\n`;
    code += `    "io/ioutil"\n`;
    code += `    "net/http"\n`;
    
    if (body) {
      code += `    "strings"\n`;
    }
    
    code += `)\n\n`;
    code += `func main() {\n`;
    code += `    url := "${url}"\n`;
    
    if (body) {
      code += `    payload := strings.NewReader(\`${JSON.stringify(body)}\`)\n\n`;
      code += `    req, _ := http.NewRequest("${method}", url, payload)\n`;
    } else {
      code += `\n    req, _ := http.NewRequest("${method}", url, nil)\n`;
    }
    
    if (headers && Object.keys(headers).length > 0) {
      Object.entries(headers).forEach(([key, value]) => {
        code += `    req.Header.Add("${key}", "${value}")\n`;
      });
    }
    
    code += `\n    res, err := http.DefaultClient.Do(req)\n`;
    code += `    if err != nil {\n`;
    code += `        panic(err)\n`;
    code += `    }\n`;
    code += `    defer res.Body.Close()\n\n`;
    code += `    body, _ := ioutil.ReadAll(res.Body)\n`;
    code += `    fmt.Println(string(body))\n`;
    code += `}`;
    
    return code;
  }
  
  generateJava(request) {
    const { method, url, headers, body } = request;
    
    let code = `import okhttp3.*;\n`;
    code += `import java.io.IOException;\n\n`;
    code += `public class ApiRequest {\n`;
    code += `    public static void main(String[] args) throws IOException {\n`;
    code += `        OkHttpClient client = new OkHttpClient().newBuilder()\n`;
    code += `            .build();\n`;
    
    if (body) {
      code += `        MediaType mediaType = MediaType.parse("application/json");\n`;
      code += `        RequestBody body = RequestBody.create(mediaType, "${JSON.stringify(body).replace(/"/g, '\\"')}");\n`;
    }
    
    code += `        Request request = new Request.Builder()\n`;
    code += `            .url("${url}")\n`;
    code += `            .method("${method}", ${body ? 'body' : 'null'})\n`;
    
    if (headers && Object.keys(headers).length > 0) {
      Object.entries(headers).forEach(([key, value]) => {
        code += `            .addHeader("${key}", "${value}")\n`;
      });
    }
    
    code += `            .build();\n`;
    code += `        Response response = client.newCall(request).execute();\n`;
    code += `        System.out.println(response.body().string());\n`;
    code += `    }\n`;
    code += `}`;
    
    return code;
  }
  
  generateCSharp(request) {
    const { method, url, headers, body } = request;
    
    let code = `using System;\n`;
    code += `using System.Net.Http;\n`;
    code += `using System.Text;\n`;
    code += `using System.Threading.Tasks;\n\n`;
    code += `class Program\n`;
    code += `{\n`;
    code += `    static async Task Main()\n`;
    code += `    {\n`;
    code += `        using var client = new HttpClient();\n`;
    
    if (headers && Object.keys(headers).length > 0) {
      Object.entries(headers).forEach(([key, value]) => {
        code += `        client.DefaultRequestHeaders.Add("${key}", "${value}");\n`;
      });
    }
    
    if (body) {
      code += `\n        var json = @"${JSON.stringify(body).replace(/"/g, '""')}";\n`;
      code += `        var content = new StringContent(json, Encoding.UTF8, "application/json");\n\n`;
    }
    
    switch(method) {
      case 'GET':
        code += `        var response = await client.GetAsync("${url}");\n`;
        break;
      case 'POST':
        code += `        var response = await client.PostAsync("${url}", ${body ? 'content' : 'null'});\n`;
        break;
      case 'PUT':
        code += `        var response = await client.PutAsync("${url}", ${body ? 'content' : 'null'});\n`;
        break;
      case 'DELETE':
        code += `        var response = await client.DeleteAsync("${url}");\n`;
        break;
      default:
        code += `        var request = new HttpRequestMessage(HttpMethod.${method.charAt(0) + method.slice(1).toLowerCase()}, "${url}");\n`;
        if (body) {
          code += `        request.Content = content;\n`;
        }
        code += `        var response = await client.SendAsync(request);\n`;
    }
    
    code += `\n        var responseString = await response.Content.ReadAsStringAsync();\n`;
    code += `        Console.WriteLine(responseString);\n`;
    code += `    }\n`;
    code += `}`;
    
    return code;
  }
  
  showDialog() {
    const dialogContent = `
      <div class="code-generator-dialog">
        <div class="language-selector">
          <h4>Select Language</h4>
          <div class="language-grid">
            ${this.languages.map(lang => `
              <button class="language-button" onclick="Alexandria.plugins.get('apicarus').codeGenerator.selectLanguage('${lang.id}')">
                <i class="${lang.icon}"></i>
                <span>${lang.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        
        <div id="generated-code-section" style="display: none;">
          <h4>Generated Code</h4>
          <div class="code-actions">
            <button class="btn btn-sm btn-secondary" onclick="Alexandria.plugins.get('apicarus').codeGenerator.copyCode()">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          </div>
          <pre id="generated-code" class="code-output"></pre>
        </div>
      </div>
      
      <style>
        .code-generator-dialog {
          min-height: 400px;
        }
        
        .language-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 16px 0;
        }
        
        .language-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          border: 1px solid var(--color-border-dark);
          background: var(--color-surface-dark);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .language-button:hover {
          background: var(--color-card-dark);
          border-color: var(--color-primary);
        }
        
        .language-button i {
          font-size: 24px;
        }
        
        .code-output {
          background: var(--color-surface-dark);
          border: 1px solid var(--color-border-dark);
          border-radius: 4px;
          padding: 16px;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
          max-height: 400px;
        }
        
        .code-actions {
          margin-bottom: 12px;
        }
      </style>
    `;
    
    this.plugin.ui?.showDialog({
      title: 'Generate Code Snippet',
      content: dialogContent,
      width: '900px',
      buttons: [
        {
          text: 'Close',
          action: 'close'
        }
      ]
    });
  }
  
  selectLanguage(language) {
    const request = {
      method: document.getElementById('apicarus-method')?.value || 'GET',
      url: document.getElementById('apicarus-url')?.value || 'https://api.example.com/endpoint',
      headers: this.plugin.getHeaders(),
      body: this.plugin.getRequestBody()
    };
    
    const code = this.generate(request, language);
    
    const codeSection = document.getElementById('generated-code-section');
    const codeElement = document.getElementById('generated-code');
    
    if (codeSection && codeElement) {
      codeSection.style.display = 'block';
      codeElement.textContent = code;
      
      // Syntax highlighting could be added here
    }
  }
  
  copyCode() {
    const codeElement = document.getElementById('generated-code');
    if (!codeElement) return;
    
    navigator.clipboard.writeText(codeElement.textContent).then(() => {
      this.plugin.ui?.showNotification({
        type: 'success',
        title: 'Code Copied',
        message: 'Code snippet copied to clipboard'
      });
    }).catch(err => {
      this.plugin.ui?.showNotification({
        type: 'error',
        title: 'Copy Failed',
        message: 'Failed to copy code to clipboard'
      });
    });
  }
}