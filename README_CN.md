<div align="center">

# Redim

一款基于 Tauri 构建的现代化跨平台 Redis 桌面客户端。

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/mintya/redim/release.yml)
![GitHub release](https://img.shields.io/github/release/mintya/redim)
![GitHub stars](https://img.shields.io/github/stars/mintya/redim)
![GitHub forks](https://img.shields.io/github/forks/mintya/redim) 

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

**[English](./README.md)** | 中文

![](./images/img1.jpg)
![](./images/img2.jpg)

</div>

## 功能特性

**连接**
- 多连接管理，支持 SSL/TLS、SSH 隧道、Cluster、Sentinel
- 侧边栏一键测试、连接、切换连接

**键浏览**
- 树状视图（按前缀分组）与平铺视图，大数据量下虚拟滚动
- 模式搜索（如 `user:*`）与按类型筛选
- 多选模式批量删除

**详情编辑**
- 多标签工作区 —— 同时打开多个 Key 并排对比
- String / Hash / List / Set / ZSet 完整增删改查
- 内联重命名与 TTL 编辑，**TTL 实时倒计时**（每个标签独立）
- String 值支持 JSON 语法高亮，可切换 Raw / Format / Hex 三种视图
- 各类型独立的筛选、排序、长值展开
- Hash：复选框多选 + 批量删除（单次 HDEL 变长参数）
- List：头/尾追加切换、重复值数量徽章
- ZSet：排名列、按分数排序、整数与浮点分数分别格式化
- 任何值 / 字段 / member / score 一键复制

**工具**
- CLI 终端，命令自动补全（`⌘K` / `Ctrl+K`）
- 监控面板 —— 服务器状态、内存、ops/sec、命中率（`⌘M` / `Ctrl+M`）
- JSON / CSV 格式导入导出
- 内置自动更新检查（通过 GitHub Releases）

**界面**
- macOS 暖色玻璃风格，搭配语义化类型色
- 跨平台：Windows、macOS、Linux

## 安装

### 下载

从 [Releases](https://github.com/mintya/redim/releases) 下载最新版本：

| 平台 | 安装包 |
|------|--------|
| Windows | `.msi` |
| macOS | `.dmg` |
| Linux | `.AppImage` / `.deb` |

### 从源码构建

```bash
git clone https://github.com/mintya/redim.git
cd redim
yarn install
yarn tauri dev      # 开发模式
yarn tauri build    # 生产构建
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘K` / `Ctrl+K` | 打开 CLI 终端 |
| `⌘M` / `Ctrl+M` | 打开监控面板 |
| `Enter` | 保存内联编辑（多行输入框为 `⌘↩` / `Ctrl+↩`） |
| `Esc` | 取消内联编辑 |

## 技术栈

- [Tauri 2](https://tauri.app/) - 桌面应用框架（Rust + WebView）
- [Svelte 5](https://svelte.dev/) - 前端框架（runes 模式）
- [Tailwind CSS 4](https://tailwindcss.com/) - 实用优先的 CSS
- [redis-rs](https://github.com/redis-rs/redis-rs) - 异步 Redis 客户端
- [Lucide Icons](https://lucide.dev/) - 图标库

## 项目结构

```
src/
├── lib/
│   ├── components/
│   │   ├── cli/           # CLI 终端
│   │   ├── common/        # Button、Modal、Toast、VirtualList 等
│   │   ├── connection/    # 连接列表 / 表单 / 切换器
│   │   ├── database/      # DbList、KeyList、KeyDetail(Workspace)
│   │   ├── import/        # 导入 / 导出
│   │   └── monitor/       # 服务器监控面板
│   ├── stores/            # Svelte stores（connection、database、toast 等）
│   ├── types/             # TypeScript 类型
│   └── utils/             # JSON / Redis / 错误处理等工具
└── routes/                # SvelteKit 页面

src-tauri/
├── src/
│   ├── lib.rs             # Tauri 命令入口
│   ├── connection.rs      # 连接注册表 + keyring 存储
│   ├── redis_manager.rs   # 异步 Redis 客户端（cluster / sentinel / SSH）
│   └── models.rs          # 共享数据模型
└── icons/                 # 应用图标
```

## 参与贡献

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/xxx`)
3. 提交更改 (`git commit -m 'Add xxx'`)
4. 推送到分支 (`git push origin feature/xxx`)
5. 创建 Pull Request

## 开源协议

MIT License

## Stargazers 趋势
[![Stargazers over time](https://starchart.cc/mintya/redim.svg?variant=adaptive)](https://starchart.cc/mintya/redim)
