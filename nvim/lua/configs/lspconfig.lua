local configs = require "nvchad.configs.lspconfig"

local servers = {
  bashls = {},
  cssls = {},
  docker_compose_language_service = {},
  dockerls = {},
  html = {},
  svelte = {},
  tailwindcss = {},
  tsserver = {},
}

for name, opts in pairs(servers) do
  opts.on_init = configs.on_init
  opts.on_attach = configs.on_attach
  opts.capabilities = configs.capabilities

  require("lspconfig")[name].setup(opts)
end

vim.diagnostic.config {
  virtual_text = { spacing = 4, prefix = "" },
  update_in_insert = true,
  underline = true,
  severity_sort = true,
}
