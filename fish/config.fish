# Fish configuration
# All modular configs are loaded from conf.d/ directory
# Files are loaded in alphabetical order:
#   00-environment.fish - Platform detection and PATH setup
#   01-aliases.fish     - Command aliases
#   02-integrations.fish - Third-party tool integrations
#   fzf.fish            - FZF integration (managed by plugin)
#   hydro.fish          - Hydro prompt (managed by plugin)

# Any machine-specific configurations can go here or in ~/.config/fish/conf.d/99-local.fish

# Added by OrbStack: command-line tools and integration
# This won't be added again if you remove it.
source ~/.orbstack/shell/init2.fish 2>/dev/null || :
