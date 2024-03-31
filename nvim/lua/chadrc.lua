---@type ChadrcConfig
local M = {}

M.ui = {
  hl_override = {
    Comment = { italic = true },
    ["@comment"] = { italic = true },
  },

  theme = "bearded-arc",
  transparency = true,

  cmp = {
    style = "atom",
  },

  telescope = { style = "bordered" },

  statusline = {
    theme = "vscode_colored",
  },

  nvdash = {
    load_on_startup = true,
  },
}

return M
