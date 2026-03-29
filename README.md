<div align="center">

# Redim

A modern, cross-platform Redis desktop client built with Tauri.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

English | **[中文](./README_CN.md)**

</div>

## Features

- **Connection Management** - Save, test and switch between multiple Redis connections
- **Tree View** - Browse keys by prefix with expandable tree structure
- **Data Operations** - Full CRUD support for String, Hash, List, Set, ZSet
- **Fuzzy Search** - Search keys with pattern matching (e.g., `user:*`)
- **CLI Terminal** - Execute Redis commands with autocomplete
- **Monitor Panel** - Real-time server stats, memory usage, ops/sec
- **Import/Export** - Backup and restore data in JSON/CSV format
- **Minimal UI** - Clean interface with dark/light theme

## Installation

### Download

Download from [Releases](https://github.com/mintya/redim/releases):

| Platform | Installer |
|----------|-----------|
| Windows | `.msi` |
| macOS | `.dmg` |
| Linux | `.AppImage` / `.deb` |

### Build from Source

```bash
git clone https://github.com/mintya/redim.git
cd redim
yarn install
yarn tauri dev      # Development
yarn tauri build    # Production
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open CLI terminal |
| `⌘M` / `Ctrl+M` | Open monitor panel |

## Tech Stack

- [Tauri](https://tauri.app/) - Desktop application framework
- [Svelte 5](https://svelte.dev/) - Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Redis](https://redis.io/) - In-memory data store

## Project Structure

```
src/
├── lib/
│   ├── components/     # UI components
│   ├── stores/         # State management
│   ├── types/          # TypeScript types
│   └── utils/          # Helper functions
└── routes/             # Pages

src-tauri/
├── src/
│   ├── lib.rs          # Tauri commands
│   ├── models.rs       # Data models
│   └── redis_manager.rs
└── icons/              # App icons
```

## Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/xxx`)
3. Commit changes (`git commit -m 'Add xxx'`)
4. Push to branch (`git push origin feature/xxx`)
5. Open Pull Request

## License

MIT License
