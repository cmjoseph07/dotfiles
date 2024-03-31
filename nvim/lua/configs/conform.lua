local options = {
  formatters_by_ft = {
    -- lua
    lua = { "stylua" },
    -- base web formats (use a sub-list to run only the first available formatter)
    javascript = { { "prettierd", "prettier" } },
    typescript = { { "prettierd", "prettier" } },
    html = { { "prettierd", "prettier" } },
    css = { { "prettierd", "prettier" } },
    -- svelte
    svelte = { { "prettierd", "prettier" } },
    -- react
    javascriptreact = { { "prettierd", "prettier" } },
    typescriptreact = { { "prettierd", "prettier" } },
    -- json
    json = { { "prettierd", "prettier" } },
    -- everything else will use lsp format
  },
  format_on_save = {
    timeout_ms = 500,
    lsp_fallback = true,
  },
}

require("conform").setup(options)
