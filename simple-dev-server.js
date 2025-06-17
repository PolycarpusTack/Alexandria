const express = require('express'); 
const path = require('path'); 
const fs = require('fs'); 
 
const app = express(); 
const PORT = 4000; 
 
app.use(express.json()); 
app.use(express.static('public')); 
 
app.get('/api/health', (req, res) => { 
  res.json({ status: 'ok', message: 'Alexandria Platform Running' }); 
}); 
 
app.get('/', (req, res) => { 
  const htmlFile = path.join(__dirname, 'Alexandria Platform Enhanced UI.html'); 
  if (fs.existsSync(htmlFile)) { 
    res.sendFile(htmlFile); 
  } else { 
    res.send('<h1>Alexandria Platform</h1><p>Server is running!</p>'); 
  } 
}); 
 
app.listen(PORT, () => { 
  console.log(`Server running at http://localhost:${PORT}`); 
}); 
