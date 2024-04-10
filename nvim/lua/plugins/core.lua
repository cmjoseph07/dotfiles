return {
  -- Using lazy.nvim
  {
    "ribru17/bamboo.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("bamboo").setup({
        transparent = true,
        highlights = {
          -- make comments blend nicely with background, similar to other color schemes
          ["@comment"] = { fg = "$grey" },
        },
      })
      require("bamboo").load()
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "bamboo",
    },
  },
}
