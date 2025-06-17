# Apicarus - Quick Start Guide

Get up and running with Apicarus in 5 minutes!

## Installation

1. Open Alexandria Platform
2. Press `Cmd+K` to open command palette
3. Type "install plugin"
4. Search for "Apicarus"
5. Click Install

## Your First Request

### 1. Open Apicarus

- Click the bolt icon in the activity bar, or
- Press `Cmd+K` and type "Apicarus"

### 2. Make a Simple GET Request

```
URL: https://api.github.com/users/github
Method: GET
```

Click **Send** or press `Cmd+Enter`

### 3. View the Response

You'll see:
- Status code (200 OK)
- Response time
- Formatted JSON response with syntax highlighting

## Essential Features

### 🔐 Add Authentication

1. Click the **Authorization** tab
2. Select **Bearer Token**
3. Enter your API token
4. The Authorization header is added automatically

### 📁 Save to Collection

1. Make a request
2. Click **Save** button
3. Name your request
4. Choose or create a collection
5. Access saved requests from the sidebar
### 🤖 Use AI Assistant

1. Click the magic wand icon
2. Type: "Create a POST request to add a new user"
3. AI generates the complete request
4. Review and send!

### 💻 Generate Code

1. Make any request
2. Click **Generate Code** button
3. Select your language (JavaScript, Python, etc.)
4. Copy the generated code

### 🔄 Environment Variables

Create environments for different stages:

1. Click **Environments** button
2. Create "Production" environment:
   ```json
   {
     "baseUrl": "https://api.production.com",
     "apiKey": "prod_key_123"
   }
   ```
3. Use in requests: `{{baseUrl}}/users`

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Request | `Cmd+Shift+N` |
| Send Request | `Cmd+Enter` |
| Save Request | `Cmd+S` |
| Import cURL | `Cmd+Shift+I` |
| Generate Code | `Cmd+Shift+G` |
| AI Assistant | `Cmd+Shift+A` |
| Switch Tabs | `Cmd+1-4` |

## Pro Tips

### 1. Quick URL Parameters
Type parameters directly in the URL:
```
https://api.example.com/users?page=1&limit=10
```
They're automatically parsed into the Parameters tab.
### 2. Request Templates
Right-click any saved request to use as template.

### 3. Response Actions
- Click any URL in response to open in new tab
- Click "Copy" icon to copy response
- Use "Download" to save response as file

### 4. History Navigation
- Use `↑` `↓` arrows to navigate request history
- Filter history by typing in search box

### 5. Bulk Testing
Select multiple requests in a collection and run all at once.

## Common Use Cases

### Testing REST API
```javascript
// GET all users
GET {{baseUrl}}/api/users

// GET single user  
GET {{baseUrl}}/api/users/123

// CREATE new user
POST {{baseUrl}}/api/users
{
  "name": "John Doe",
  "email": "john@example.com"
}

// UPDATE user
PUT {{baseUrl}}/api/users/123
{
  "name": "John Updated"
}

// DELETE user
DELETE {{baseUrl}}/api/users/123
```

### Working with Authentication
```javascript
// Bearer Token
Authorization: Bearer {{authToken}}

// Basic Auth
Authorization: Basic base64(username:password)

// API Key
X-API-Key: {{apiKey}}
```

## Need Help?

- 📚 [Full Documentation](../README.md)
- 💬 [Discord Community](https://discord.gg/alexandria)
- 🐛 [Report Issues](https://github.com/alexandria-platform/apicarus/issues)

Happy API Testing! 🚀