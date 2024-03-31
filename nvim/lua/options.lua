require "nvchad.options"

local o = vim.o
local opt = vim.opt

o.cursorlineopt = "both" -- to enable cursorline!
opt.shell = "fish"
opt.relativenumber = true
opt.mouse = "a"
opt.showmode = false
opt.clipboard = "unnamedplus"
opt.breakindent = true
opt.undofile = true
opt.ignorecase = true
opt.smartcase = true
opt.signcolumn = "yes"
opt.updatetime = 250
opt.timeoutlen = 300
opt.splitright = true
opt.splitbelow = true
opt.list = true
opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }
opt.inccommand = "split"
opt.scrolloff = 10
opt.hlsearch = true
