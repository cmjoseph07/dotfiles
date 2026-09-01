# 💤 Neovim

[LazyVim](https://github.com/LazyVim/LazyVim) config, tracked so a fresh clone reproduces the same editor.

Neovim itself is provisioned by mise (`neovim = "stable"` in [`mise/config.toml`](../mise/config.toml)), not by the system package manager, and `00-environment.fish` picks it up as `$EDITOR`.

## Layout

- `init.lua` - bootstraps `config.lazy`
- `lua/config/lazy.lua` - lazy.nvim bootstrap and the LazyVim spec
- `lua/config/{autocmds,keymaps,options}.lua` - loaded automatically by LazyVim; still stock
- `lazyvim.json` - enabled LazyVim extras: `lang.json`, `lang.markdown`, `lang.toml`
- `lazy-lock.json` - pinned plugin revisions; commit it after `:Lazy sync` so other machines resolve the same versions
- `stylua.toml` - lua formatting (2 spaces, 120 columns)
- `.neoconf.json` - enables the lua_ls library for editing this config

## Adding plugins

`lua/config/lazy.lua` imports a `plugins` module, so create `lua/plugins/<name>.lua` returning a lazy.nvim spec.
`lua/plugins/init.lua` is an empty spec that keeps that import satisfied; without any spec in the directory, `:checkhealth lazy` reports `No specs found for module "plugins"`.
