local options = { window = { documentation = {} } }

-- change documentation style when transparency is enabled
if require("nvconfig").ui.transparency then
  options.window.documentation.border = "single"
  options.window.documentation.winhighlight = "Normal:CmpDocTransparent,FloatBorder:CmpDocBorder"
end

return options
