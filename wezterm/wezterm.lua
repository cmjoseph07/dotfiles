local wezterm = require "wezterm"
local config = wezterm.config_builder()

-- Font
config.font = wezterm.font("MonoLisa")

-- Cursor
config.default_cursor_style = "BlinkingBlock"
config.animation_fps = 1
config.cursor_blink_rate = 500

-- Window
config.term = "xterm-256color"
config.window_background_opacity = 0.95
config.cell_width = 0.9
config.font_size = 18.0

-- Tabs
config.hide_tab_bar_if_only_one_tab = true
config.use_fancy_tab_bar = false

-- Colors
config.color_scheme = "Ayu Mirage (Gogh)"

return config