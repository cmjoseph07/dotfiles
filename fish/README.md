# Fish Shell Configuration

Portable fish configuration for macOS, Linux, and WSL2.
Every integration is guarded by an existence check, so a machine missing a tool skips it instead of erroring.

## Structure

```
fish/
├── config.fish              # Minimal; documents the conf.d layout
├── conf.d/                  # Auto-loaded alphabetically
│   ├── 00-environment.fish  # XDG dirs, PATH, editor (runs for every shell)
│   ├── 01-aliases.fish      # Command aliases (interactive only)
│   ├── 02-integrations.fish # mise, zoxide, fzf, atuin (interactive only)
│   ├── 03-bash-fallback.fish# Pasted bash auto-runs through bash -c
│   ├── 04-theme.fish        # Gruvbox colors
│   ├── pure.fish            # Plugin-managed (fisher)
│   └── _pure_init.fish      # Plugin-managed (fisher)
├── functions/               # fish_greeting, lh + plugin-managed functions
├── completions/             # Tool-installed, gitignored (except fisher's)
└── fish_plugins             # Plugin list for fisher
```

`completions/` is not tracked.
Tools install their own completions there - OrbStack symlinks `docker`, `kubectl`, and `orbctl` into `/Applications`, and `bun completions` writes its own - so the contents are machine- and OS-specific.
Committing them would ship dangling macOS symlinks to a Linux clone.
Only `fisher.fish` is tracked, because fisher is a plugin and follows the same vendoring rule as the `pure` files.

## Design rules

- All configuration lives in tracked files at global scope.
  `fish_variables` holds only fisher bookkeeping and pure's auto-generated defaults, and is gitignored.
- `00-environment.fish` runs for every shell, including non-interactive ones, so scripts, editors, and `ssh host cmd` get the same PATH as a terminal.
- Interactive-only concerns (aliases, prompt integrations, key bindings) sit behind `status is-interactive`.
- PATH entries use `fish_add_path -g`: recomputed per shell, deduplicated, and never persisted as universal state.
- Homebrew is detected across all three prefixes: `/opt/homebrew` (Apple Silicon), `/usr/local` (Intel macOS), `/home/linuxbrew/.linuxbrew` (Linux).
- mise is activated for interactive shells and exposed to non-interactive shells through its shims directory.

## Plugins

Managed by fisher via `fish_plugins`:

- `jorgebucaran/fisher` - the plugin manager itself
- `patrickf1/colored_man_pages.fish` - colored man pages
- `pure-fish/pure` - prompt

Key bindings come from tools, not plugins: atuin owns Ctrl-R and up-arrow (history), fzf's native integration owns Ctrl-T (files) and Alt-C (cd).

Node is managed by mise (`mise/config.toml`), not a fish plugin.

## New machine

Handled by `bootstrap.fish` at the repo root; see the top-level README.

## Customization

- Machine-specific settings: create `conf.d/99-local.fish` (gitignored).
- Everything else: edit the numbered `conf.d/` files directly.
