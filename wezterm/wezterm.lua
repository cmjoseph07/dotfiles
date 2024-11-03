--[[
  Main
]]

local wezterm = require "wezterm"
local act = wezterm.action
local config = {}

if wezterm.config_builder then config = wezterm.config_builder() end

config.font = wezterm.font("MonoLisa")

-- Cursor
config.default_cursor_style = "BlinkingBlock"
config.animation_fps = 1
config.cursor_blink_rate = 500

-- Window
config.term = "xterm-256color"
config.window_background_opacity = 0.95
config.window_decorations = "RESIZE"
config.cell_width = 0.9
config.font_size = 18.0

-- Tabs
config.enable_tab_bar = false
config.enable_scroll_bar = false
config.switch_to_last_active_tab_when_closing_tab = true
config.tab_and_split_indices_are_zero_based = false
config.tab_bar_at_bottom = false

-- Colors
config.color_scheme = "Ayu Mirage (Gogh)"

-- Windows OS Specific
if wezterm.target_triple == "x86_64-pc-windows-msvc" then
  config.default_domain = "WSL:Ubuntu"
  config.launch_menu = {
    {
      label = "PowerShell",
      args = { "powershell.exe" }
    }
  }
end

return config