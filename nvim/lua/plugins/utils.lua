return {
  {
    "windwp/nvim-ts-autotag",
    ft = { "html", "svelte", "markdown", "typescript", "xml" },
    opts = require "configs.nvim-ts-autotag",
  },
  {
    "nvimdev/lspsaga.nvim",
    event = "VeryLazy",
    opts = require "configs.lspsaga",
  },
  {
    "tpope/vim-surround",
    event = "VeryLazy",
  },
  {
    "brenoprata10/nvim-highlight-colors",
    opts = require "configs.nvim-highlight-colors",
  },
  {
    "max397574/better-escape.nvim",
    event = "InsertEnter",
    config = function()
      require("better_escape").setup()
    end,
  },
  {
    "mg979/vim-visual-multi",
    event = "VeryLazy",
  },
}
