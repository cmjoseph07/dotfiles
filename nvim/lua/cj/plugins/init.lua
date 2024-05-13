return {
	{
		"nvim-lua/plenary.nvim", -- lua functions that many plugins use
	},
	{
		"MunifTanjim/nui.nvim",
		lazy = true,
	},
	{
		"iamcco/markdown-preview.nvim",
		lazy = true,
		event = "VeryLazy",
		cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
		ft = "markdown",
		build = function()
			vim.fn["mkdp#util#install"]()
		end,
	},
}
