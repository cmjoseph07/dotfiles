local opt = vim.opt
local cmd = vim.cmd

opt.completeopt = "menu,menuone,preview,noinsert"

cmd.colorscheme "cyberdream"

opt.inccommand = "split"

opt.smartcase = true
opt.ignorecase = true

opt.cursorline = true
opt.showmode = false

opt.number = true
opt.relativenumber = true

opt.splitbelow = true
opt.splitright = true

opt.signcolumn = "yes"
opt.shada = { "'10", "<0", "s10", "h" }

opt.clipboard = "unnamedplus"
opt.mouse = "a"

opt.undofile = true
opt.swapfile = false

opt.conceallevel = 1
opt.scrolloff = 10

opt.tabstop = 2
opt.shiftwidth = 2
opt.autoindent = true
opt.expandtab = true

opt.formatoptions:remove "o"
