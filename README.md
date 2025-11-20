# TXT-Forge ⚒️

**Turn your codebase into AI-ready text context instantly.**

TXT-Forge scans your project, detects your tech stack (TypeScript, Python, Rust, etc.), and merges your code into optimized text files. It handles `.gitignore` rules automatically and splits large files so they fit into ChatGPT, Claude, or Gemini context windows.

![License](https://img.shields.io/npm/l/txt-forge)

![Version](https://img.shields.io/npm/v/txt-forge)

## 🚀 Quick Start

You don't need to clone this repo. Just run it anywhere:

```bash
# Install globally
npm install -g txt-forge

# Run in any project folder
txt-forge
```

This will launch a local GUI in your browser.

## ✨ Features

- **Auto-Detection**: Smartly identifies frameworks (React, SvelteKit, Django, Laravel, etc.).
- **Visual Tree Selection**: Pick exactly which files or folders to include.
- **Smart Splitting**: Files larger than your limit (e.g., 75k chars) are split at function boundaries, not randomly.
- **Respects Git**: Automatically respects your .gitignore rules.
- **Privacy First**: Runs 100% locally. Your code never leaves your machine.

## 📦 Installation

Ensure you have Node.js installed (v18 or higher recommended).

```bash
npm install -g txt-forge
```

## 🛠️ Usage

1. Open your terminal in the project you want to convert.
2. Run `txt-forge`.
3. Select your files in the browser window.
4. Click Save to Project or Save to Global Vault.

## 📄 Output Format

TXT-Forge creates a folder (default: TXT-Forge/) containing:

- **Source-Tree.txt**: A visual map of your project structure.
- **Source-1.txt**: Your combined code files with clear headers.

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Clone the repo
2. Run `npm install`
3. Run `npm run dev` to start the development server

## 📝 License

MIT © DavidMGDev
