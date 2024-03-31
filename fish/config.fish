
# eza
alias ld='eza -Dl' # List only directories
alias lf='eza -fFl --color=always' # List only files
alias lh='eza -dl .* --group --header --group-directories-first' # List only hidden files
alias ls='eza -al --group --header --group-directories-first' # List everything with directories first
alias lt='eza -al --sort=modified' # List everything sorted by time updated

zoxide init fish | source

starship init fish | source

