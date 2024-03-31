local lint = require "lint"

lint.linters_by_ft = {
  javascript = { "eslint_d" },
  typescript = { "eslint_d" },
  svelte = { "eslint_d" },
}

local lint_augroup = vim.api.nvim_create_augroup("lint", { clear = true })

vim.api.nvim_create_autocmd({ "BufWritePost", "InsertLeave", "CursorHold" }, {
  group = lint_augroup,
  callback = function()
    lint.try_lint()
  end,
})
