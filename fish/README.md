# Fish Shell Configuration

This is a portable Fish shell configuration that works across macOS, Linux, and WSL2.

## Structure

```
.config/fish/
├── config.fish          # Main config (minimal, loads conf.d/)
├── conf.d/              # Modular config files (auto-loaded)
│   ├── 00-environment.fish  # Platform detection & PATH setup
│   ├── 01-aliases.fish      # Command aliases
│   ├── 02-integrations.fish # Third-party tool integrations
│   ├── 03-colors.fish       # Color scheme and theme settings
│   ├── fzf.fish             # FZF integration (plugin-managed)
│   ├── hydro.fish           # Hydro prompt (plugin-managed)
│   └── nvm.fish             # Node version manager (plugin-managed)
├── functions/           # Fish functions (mostly plugin-managed)
├── completions/         # Command completions (plugin-managed)
├── fish_plugins         # Plugin list for Fisher
└── fish_variables       # Fish universal variables

```

## Installation on New Machine

1. Install Fish shell:
   - macOS: `brew install fish`
   - Ubuntu/Debian: `sudo apt install fish`
   - Arch: `sudo pacman -S fish`
   - WSL2: Use your distro's package manager

2. Clone this config:
   ```bash
   git clone <your-repo> ~/.config/fish
   ```

3. Install Fisher (plugin manager):
   ```bash
   curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher
   ```

4. Install plugins:
   ```bash
   fisher update
   ```

5. Install optional dependencies (as needed):
   - `eza` - Better ls replacement
   - `zoxide` - Smarter cd command
   - `fzf` - Fuzzy finder
   - `fastfetch` - System info for greeting

## Platform Detection

The configuration automatically detects:
- macOS (IS_MAC)
- Linux (IS_LINUX)
- WSL2 (IS_WSL)

Platform-specific settings are applied automatically.

## Customization

- Machine-specific settings: Create `~/.config/fish/conf.d/99-local.fish`
- Additional aliases: Edit `conf.d/01-aliases.fish`
- Environment variables: Edit `conf.d/00-environment.fish`
- Color scheme: Edit `conf.d/03-colors.fish`

## Plugins

Managed by Fisher:
- `jorgebucaran/hydro` - Minimal, fast prompt
- `jorgebucaran/nvm.fish` - Node version manager
- `patrickf1/fzf.fish` - FZF integration
- `patrickf1/colored_man_pages.fish` - Colored man pages

## Notes

- PATH additions use `fish_add_path` which prevents duplicates
- All paths are checked for existence before adding
- Configuration is modular and loads from `conf.d/` alphabetically
- Colors and theme settings are in `conf.d/03-colors.fish` (not in fish_variables)
- Universal variables in `fish_variables` are minimal (only Fisher plugin tracking)