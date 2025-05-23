### Alias ###

# General
alias c 'clear'
alias g 'git'

# eza
alias ld 'eza -Dl'             			# List only directories
alias lf 'eza -fl'            		     	# List only files
alias lh 'eza -a | grep "^\."'  	     	# List hidden files
alias ls 'eza -al --group-directories-first'  	# List everything, directories first
alias lt 'eza -al -s modified' 	# List everything by time modified

# ncu
alias ncu 'ncu --interactive --format group'

# Cursor
alias code 'cursor'

### Global(s) ###
set --global hydro_symbol_git_dirty ' •'

### Init(s) ###
zoxide init fish | source

### Path/Export ###
# Bun
set --export BUN_INSTALL "$HOME/.bun"
set --export PATH $BUN_INSTALL/bin $PATH
