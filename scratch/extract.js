const fs = require('fs');

const logContent = fs.readFileSync('C:\\Users\\user\\.gemini\\antigravity\\brain\\c4c9d64f-e12a-4cf7-bd43-45d0130afb75\\.system_generated\\logs\\overview.txt', 'utf8');

// The file has json per line
const lines = logContent.split('\n');
let prompt = '';

for (const line of lines) {
  if (line.includes('Parte 1') || line.includes('Clasificación Técnica')) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.message) {
        prompt += parsed.message + '\n';
      } else if (parsed.content) {
        prompt += parsed.content + '\n';
      } else if (parsed.tool_calls) {
        prompt += JSON.stringify(parsed) + '\n';
      }
    } catch (e) {
      prompt += line + '\n';
    }
  }
}

fs.writeFileSync('C:\\Users\\user\\Documents\\Proyectos\\crm\\extracted_prompt.txt', prompt);
