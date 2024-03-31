return {
  "neovim/nvim-lspconfig",
  config = function()
    require("nvchad.configs.lspconfig").defaults()
    require "configs.lspconfig"
  end,
  dependencies = {
    -- format
    {
      "stevearc/conform.nvim",
      event = "BufWritePre",
      config = function()
        require "configs.conform"
      end,
    },
    -- linting
    {
      "mfussenegger/nvim-lint",
      config = function()
        require "configs.nvim-lint"
      end,
    },
    -- manage lsp servers
    {
      "williamboman/mason.nvim",
      opts = require("configs.mason").mason,
    },
  },
}
