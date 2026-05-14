<div align="center">

# Redim

A modern, cross-platform Redis desktop client built with Tauri.

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/mintya/redim/release.yml)
![GitHub release](https://img.shields.io/github/release/mintya/redim)
![GitHub stars](https://img.shields.io/github/stars/mintya/redim)
![GitHub forks](https://img.shields.io/github/forks/mintya/redim) 

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

English | **[中文](./README_CN.md)**

![](./images/img1.jpg)
![](./images/img2.jpg)

</div>



## Features

**Connections**
- Multiple saved profiles with SSL/TLS, SSH tunnel, Cluster, and Sentinel support
- Test, connect, and switch profiles from the sidebar

**Key browser**
- Tree view (prefix-grouped) and flat list, virtualized for large key sets
- Pattern search (e.g. `user:*`) and type filter chips
- Multi-select mode for batch delete

**Detail editor**
- Multi-tab workspace — open several keys side by side
- Full CRUD for String, Hash, List, Set, ZSet
- Inline rename and TTL editing with a **live TTL countdown** (per tab)
- JSON syntax highlighting + Raw / Format / Hex view modes for String values
- Per-type filter, sort, expand-to-inspect for long values
- Hash: multi-select batch delete (variadic HDEL, one round trip)
- List: head/tail push toggle, duplicate-count badge
- ZSet: rank column, score sort, integer & float-aware score formatting
- One-click copy on every value, field, member, or score

**Tools**
- CLI terminal with command autocomplete (`⌘K` / `Ctrl+K`)
- Monitor panel — server stats, memory, ops/sec, hit rate (`⌘M` / `Ctrl+M`)
- Import / Export keys in JSON or CSV
- Built-in auto-update check via GitHub Releases

**UI**
- macOS-style warm glass aesthetic with semantic type colors
- Cross-platform: Windows, macOS, Linux

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
| `Enter` | Save inline edit (textarea: `⌘↩` / `Ctrl+↩`) |
| `Esc` | Cancel inline edit |

## Tech Stack

- [Tauri 2](https://tauri.app/) - Desktop application framework (Rust + WebView)
- [Svelte 5](https://svelte.dev/) - Frontend framework (runes mode)
- [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS
- [redis-rs](https://github.com/redis-rs/redis-rs) - Async Redis client
- [Lucide Icons](https://lucide.dev/) - Icon set

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── cli/           # CLI terminal panel
│   │   ├── common/        # Button, Modal, Toast, VirtualList, …
│   │   ├── connection/    # Connection list / form / switcher
│   │   ├── database/      # DbList, KeyList, KeyDetail(Workspace)
│   │   ├── import/        # Import / Export
│   │   └── monitor/       # Server monitor panel
│   ├── stores/            # Svelte stores (connection, database, toast, …)
│   ├── types/             # TypeScript types
│   └── utils/             # JSON helpers, Redis helpers, error handling
└── routes/                # SvelteKit pages

src-tauri/
├── src/
│   ├── lib.rs             # Tauri command handlers
│   ├── connection.rs      # Connection registry + keyring storage
│   ├── redis_manager.rs   # Async Redis client (cluster / sentinel / SSH)
│   └── models.rs          # Shared data models
└── icons/                 # App icons
```

## Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/xxx`)
3. Commit changes (`git commit -m 'Add xxx'`)
4. Push to branch (`git push origin feature/xxx`)
5. Open Pull Request

## License

MIT License

## Stargazers over time
[![Stargazers over time](https://starchart.cc/mintya/redim.svg?variant=adaptive)](https://starchart.cc/mintya/redim)
