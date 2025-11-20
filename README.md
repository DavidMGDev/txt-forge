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

### Interactive Mode (GUI)

Simply run the command in your project folder to launch the local web interface:

```bash
txt-forge
```

### Auto Mode (CLI Only)

Skip the browser and instantly convert your project using auto-detection:

```bash
# Auto-detect and save to ./TXT-Forge/ folder
txt-forge --auto

# Save to Global Vault instead (~/.txt-forge-vault)
txt-forge -a --vault

# Save to a specific custom path
txt-forge -a --custom "C:/Users/Dev/Desktop/MyContext"

# or short alias:
txt-forge -a -c "./my-output"

# Include ignored files (like package-lock.json) in the Source Tree map
# (Useful for giving AI context on dependencies without including the file content)
txt-forge -a --ignored

# Combine flags (Auto + Custom Path + Ignored)
txt-forge -a -i -c "./output"
```

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
