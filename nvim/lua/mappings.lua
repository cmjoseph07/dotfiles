require "nvchad.mappings"

local map = vim.keymap.set

map("n", ";", ":", { desc = "CMD enter command mode" })
map("n", "<Esc>", "<cmd>nohlsearch<CR>")
map("i", "jk", "<ESC>")
-- comment
map("v", "<leader>_", function()
  require("Comment.api").toggle.blockwise.current()
end, { desc = "Block comment Toggle" })
-- trouble
map("n", "<leader>tt", "<cmd>TroubleToggle<CR>", { desc = "Toggle Trouble panel on/off" })
