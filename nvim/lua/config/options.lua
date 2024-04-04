local g, opt = vim.g, vim.opt

-- Colorscheme
g.moonflyTransparent = true

-- Default Overrides
g.maplocalleader = " "
opt.clipboard = "unnamedplus"
opt.inccommand = "split"

-- Additional Options
opt.breakindent = true
opt.listchars = { tab = "» ", trail = "·", nbsp = "␣" }
opt.hlsearch = true
