local wezterm = require("wezterm")

local config = wezterm.config_builder()

-- ── Appearance ──────────────────────────────────────────────────────────────
config.color_scheme = "Gruvbox dark, hard (base16)"
config.font_size = 12.5

-- ── Window ───────────────────────────────────────────────────────────────────
config.macos_window_background_blur = 50 -- ignored outside macOS
config.window_background_opacity = 0.8
config.window_decorations = "RESIZE"     -- drop title bar, keep resizable borders

-- ── Tabs ─────────────────────────────────────────────────────────────────────
config.hide_tab_bar_if_only_one_tab = true

-- ── Platform ─────────────────────────────────────────────────────────────────
-- macOS and Linux launch the login shell (fish, via chsh). Windows has no
-- native fish, so fall back to PowerShell there.
if wezterm.target_triple:find("windows") then
  config.default_prog = { "powershell.exe", "-NoLogo" }
end

return config
