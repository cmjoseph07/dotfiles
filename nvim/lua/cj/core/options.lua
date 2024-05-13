local opt = vim.opt
local g = vim.g

--- GLOBALS ---

-- leader key
g.mapleader = " "
g.maplocalleader = " "

-- Nerd font
g.have_nerd_font = true

--- OPTIONS ---

-- line numbers
opt.number = true
opt.numberwidth = 2
opt.relativenumber = true

-- indenting
opt.autoindent = true
opt.expandtab = true
opt.smartindent = true
opt.tabstop = 2
opt.softtabstop = 2
opt.shiftwidth = 2

-- search settings
opt.ignorecase = true
opt.smartcase = true

-- statusbar
opt.laststatus = 3
opt.showmode = false

-- appearance
opt.termguicolors = true
opt.signcolumn = "yes"
opt.scrolloff = 10
opt.breakindent = true
opt.cursorline = true
opt.list = true
opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }
opt.inccommand = "split"
opt.hlsearch = true
opt.cmdheight = 1
opt.completeopt = { "menuone", "noselect" }
opt.conceallevel = 0

-- split windows
opt.splitright = true
opt.splitbelow = true

-- mouse / clipboard
opt.mouse = "a"
opt.clipboard = "unnamedplus"
opt.backspace = "indent,eol,start"

-- undo / update
opt.undofile = true
opt.swapfile = false
opt.updatetime = 250
opt.timeoutlen = 300
