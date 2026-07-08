local wezterm = require("wezterm")

local config = wezterm.config_builder()

-- ── Appearance ──────────────────────────────────────────────────────────────
config.color_scheme = "Gruvbox dark, hard (base16)"
config.font_size = 12.5

-- ── Window ───────────────────────────────────────────────────────────────────
config.macos_window_background_blur = 50
config.window_background_opacity = 0.8
config.window_decorations = "RESIZE"     -- drop title bar, keep resizable borders

-- ── Tabs ─────────────────────────────────────────────────────────────────────
config.hide_tab_bar_if_only_one_tab = true

return config
