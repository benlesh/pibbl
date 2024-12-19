import { saveAs } from 'file-saver';
import JSZip from 'jszip';

interface FileEntry {
  filename: string;
  content: string;
}

export async function downloadProject(code: string) {
  const files: FileEntry[] = [
    {
      filename: 'App.tsx',
      content: code,
    },
    {
      filename: 'README.md',
      content: `# CRC Component

This is a Canvas React Component created in the CRC Playground.

## Usage

\`\`\`typescript
import { crc } from '@crc/core'
import { MyComponent } from './App'

// Use the component
crc(canvas, MyComponent({
  // Your props here
}))
\`\`\`

## Dependencies

- @crc/core
- @crc/jsx
`,
    },
    {
      filename: 'package.json',
      content: JSON.stringify(
        {
          name: 'crc-component',
          type: 'module',
          version: '0.0.0',
          private: true,
          dependencies: {
            '@crc/core': 'latest',
            '@crc/jsx': 'latest',
          },
        },
        null,
        2,
      ),
    },
  ];

  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'crc-component.zip');
}
