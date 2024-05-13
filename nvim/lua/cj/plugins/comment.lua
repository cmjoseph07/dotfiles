return {
  {
    "echasnovski/mini.comment",
    event = "VeryLazy",
    opts = {
      options = {
        custom_commentstring = function()
          return require("ts_context_commentstring.internal").calculate_commentstring() or vim.bo.commentstring
        end,
      },
    },
  },
  {
    "JoosepAlviste/nvim-ts-context-commentstring", -- Comment ts context files
    lazy = true,
    event = { "BufReadPost", "BufNewFile" },
    config = function()
      require('ts_context_commentstring').setup {
        enable = true,
        enable_autocmd = false,
        config = {
          typescript = "// %s",
          css = "/* %s */",
          scss = "/* %s */",
          html = "<!-- %s -->",
          svelte = "<!-- %s -->",
          vue = "<!-- %s -->",
          json = ""
        }
      }
    end
  }
}
