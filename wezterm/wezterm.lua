local wezterm = require "wezterm"
local act = wezterm.action
local config = {}

if wezterm.config_builder then
    config = wezterm.config_builder()
end

-- Font 
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
config.font_size = 14.0

-- Tabs
config.hide_tab_bar_if_only_one_tab = true
config.switch_to_last_active_tab_when_closing_tab = true
config.tab_and_split_indices_are_zero_based = false

-- Colors
config.color_scheme = 'Gruber (base16)'

-- OS-Specific Configuration
if wezterm.target_triple:match("w indows") then
    config.default_domain = "WSL:Ubuntu"
    config.launch_menu = {{
        label = "PowerShell",
        args = {"powershell.exe"}
    }}
end

-- Determine OS to set Leader Key Modifiers
local is_windows = wezterm.target_triple:match("windows") ~= nil

-- Leader Key

config.keys = {{
  key = "v",
  mods = "CMD",
  action = act {
    PasteFrom = "Clipboard"
  }
}, {
  key = "c",
  mods = "CMD",
  action = act {
    CopyTo = "Clipboard"
  }
}, {
  key = "[",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateCopyMode
}, 
-- Tab navigation
{
  key = "l",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateLastTab
}, {
  key = "n",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateTabRelative(1)
}, {
  key = "p",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateTabRelative(-1)
}, {
  key = "c",
  mods = "CTRL|SHIFT|ALT",
  action = act {
    SpawnTab = "CurrentPaneDomain"
  }
}, {
  key = "d",
  mods = "CTRL|SHIFT|ALT",
  action = act {
    CloseCurrentTab = {
      confirm = true
    }
  }
},{
  key = "p",
  mods = "CTRL|SHIFT|ALT",
  action = act.CloseCurrentPane { confirm = true },
}, {
  key = "1",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateTab(0)
}, {
  key = "2",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateTab(1)
}, {
  key = "3",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateTab(2)
}, {
  key = "4",
  mods = "CTRL|SHIFT|ALT",
  action = act.ActivateTab(3)
}, {
  key = "f",
  mods = "CTRL|SHIFT|ALT",
  action = act.ShowLauncherArgs {
    flags = "FUZZY|TABS"
  }
}, {
  key = ",",
  mods = "CTRL|SHIFT|ALT",
  action = act.PromptInputLine {
    description = "Enter new name for tab:",
    action = wezterm.action_callback(function(window, pane, line)
      if line then
        window:active_tab():set_title(line)
      end
    end)
  }
}, 
-- Pane navigation
{
  key = "h",
  mods = "CTRL|SHIFT|ALT",
  action = wezterm.action.SplitPane({
    direction = "Right",
    size = { Percent = 50 },
  }),
},
{
  key = "v",
  mods = "CTRL|SHIFT|ALT",
  action = wezterm.action.SplitPane({
    direction = "Down",
    size = { Percent = 50 },
  }),
},
{
  key = "u",
  mods = "CTRL|SHIFT|ALT",
  action = act.AdjustPaneSize({ "Left", 5 }),
},
{
  key = "i",
  mods = "CTRL|SHIFT|ALT",
  action = act.AdjustPaneSize({ "Down", 5 }),
},
{
  key = "b",
  mods = "CTRL|SHIFT|ALT",
  action = act.AdjustPaneSize({ "Up", 5 }),
},
{
  key = "r",
  mods = "CTRL|SHIFT|ALT",
  action = act.AdjustPaneSize({ "Right", 5 }),
},
{
  key = '0',
  mods = 'CTRL|SHIFT|ALT',
  action = act.PaneSelect
},
{
  key = "o",
  mods = "CTRL|SHIFT|ALT",
  -- toggling opacity
  action = wezterm.action_callback(function(window, _)
    local overrides = window:get_config_overrides() or {}
    if overrides.window_background_opacity == 1.0 then
      overrides.window_background_opacity = 0.9
    else
      overrides.window_background_opacity = 1.0
    end
    window:set_config_overrides(overrides)
  end),
},
-- Workspace navigation
{
  key = "x",
  mods = "CTRL|SHIFT|ALT",
  action = act.SwitchToWorkspace {
    name = "default"
  }
}, {
  key = "y",
  mods = "CTRL|SHIFT|ALT",
  action = act.SwitchToWorkspace {
    name = "secondary"
  }
}, {
  key = "w",
  mods = "CTRL|SHIFT|ALT",
  action = act.ShowLauncherArgs {
    flags = "FUZZY|WORKSPACES"
  }
}, {
  key = "s",
  mods = "CTRL|SHIFT|ALT",
  action = act.PromptInputLine {
    description = "Enter new name for session:",
    action = wezterm.action_callback(function(window, pane, line)
      if line then
        wezterm.mux.rename_workspace(wezterm.mux.get_active_workspace(), line)
      end
    end)
  }
},
-- Disable defaults
{
  key = "Enter",
  mods = "ALT",
  action = wezterm.action.DisableDefaultAssignment
}, {
  key = "Tab",
  mods = "CTRL",
  action = wezterm.action.DisableDefaultAssignment
}}

return config
