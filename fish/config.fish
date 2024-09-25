# alias
alias ld='eza -Dl' # List only directories
alias lf='eza -fFl --color=always' # List only files
alias lh='eza -dl .* --group --header --group-directories-first' # List only hidden files
alias ls='eza -al --group --header --group-directories-first' # List everything with directories first
alias lt='eza -al --sort=modified' # List everything sorted by time updated
alias pn='pnpm'
alias ncu='ncu --interactive --format group'

set fish_cursor_default block

zoxide init fish | source

# bun
set --export BUN_INSTALL "$HOME/.bun"
set --export PATH $BUN_INSTALL/bin $PATH
