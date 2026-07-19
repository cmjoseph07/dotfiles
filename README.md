# 🚀 cmjoseph07 dotfiles

> [!NOTE]
> An attempt to keep things elegant, simple and OS-agnostic.

## 📦 Setup

This repo is the `~/.config` directory itself.
On a fresh machine, install fish and git, clone, then run the bootstrap script.

```bash
git clone https://github.com/cmjoseph07/dotfiles.git ~/.config
fish ~/.config/bootstrap.fish
```

The bootstrap is idempotent: it installs fisher and its plugins, provisions mise tools, and prints an install command for anything still missing.
Everything in the configs is existence-guarded, so a machine without some tool skips it instead of erroring.
Windows is covered via WSL2; WezTerm on native Windows falls back to PowerShell.

## 🐚 Shell

- [Fish](https://github.com/fish-shell/fish-shell) - The friendly interactive shell
  - [Fisher](https://github.com/jorgebucaran/fisher) - Plugin manager for fish
  - [Pure](https://github.com/pure-fish/pure) - Pretty, minimal and fast fish prompt, ported from zsh.

## 💻 Terminal

- [WezTerm](https://github.com/wezterm/wezterm) - GPU-accelerated cross-platform terminal emulator and multiplexer written in Rust

## 🛠️ Tools

- [Atuin](https://github.com/atuinsh/atuin) - Shell history with sync, stats and context-aware search
- [Bat](https://github.com/sharkdp/bat) - Cat clone with syntax highlighting and Git integration
- [Eza](https://github.com/eza-community/eza) - Modern replacement for 'ls'
- [Fastfetch](https://github.com/fastfetch-cli/fastfetch) - Fast system information tool
- [Fd](https://github.com/sharkdp/fd) - Simple, fast and user-friendly alternative to 'find'
- [Fzf](https://github.com/junegunn/fzf) - Command-line fuzzy finder
- [Mise](https://github.com/jdx/mise) - dev tools, env vars, task runner
- [Ripgrep](https://github.com/BurntSushi/ripgrep) - Recursively search directories for a regex pattern
- [Zoxide](https://github.com/ajeetdsouza/zoxide) - Smarter cd command inspired by z and autojump

## 🧭 Layout

- `atuin/` - shell history settings; the history db and sync key stay in `~/.local/share/atuin`
- `fish/` - shell config, see [fish/README.md](fish/README.md)
- `git/` - git identity and global ignore, at git's XDG default paths so no absolute paths are needed
- `mise/` - global tool versions (node lts)
- `wezterm/` - terminal config, platform-aware
- `bootstrap.fish` - new machine setup
