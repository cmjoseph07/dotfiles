return {
	"folke/which-key.nvim",
	event = "VeryLazy",
	opts = {
		plugins = { spelling = true },
		defaults = {
			mode = { "n", "v" },
			["g"] = { name = "+goto" },
			["gs"] = { name = "+surround" },
			["z"] = { name = "+fold" },
			["]"] = { name = "+next" },
			["["] = { name = "+prev" },
			["<leader>"] = { name = "+leader" },
			["<leader><tab>"] = { name = "+tabs" },
			["<leader>b"] = { name = "+buffer" },
			["<leader>c"] = { name = "+see code available actions" },
			["<leader>m"] = { name = "+format" },
			["<leader>f"] = { name = "+file" },
			["<leader>g"] = { name = "+comment/lsp/surround" },
			["<leader>q"] = { name = "+quit/session" },
			["<leader>r"] = { desc = "+re-name/restart lsp" },
			["<leader>s"] = { name = "+search" },
			["<leader>u"] = { name = "+ui" },
			["<leader>w"] = { name = "+windows" },
			["<leader>x"] = { name = "+trouble" },
		},
		icons = {
			breadcrumb = "»",
			separator = "",
			group = "+",
		},
	},
	config = function(_, opts)
		local wk = require("which-key")
		wk.setup(opts)
		wk.register(opts.defaults)
	end,
}
