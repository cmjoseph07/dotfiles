if status is-interactive
    # General
    alias .. 'cd ..'
    alias c 'clear'
    alias cc 'claude --dangerously-skip-permissions'
    alias add 'git add .'
    alias push 'git push'
    alias pull 'git pull'
    alias m 'git switch main'

    command -q nvim; and alias vim 'nvim'

    command -q frizzante; and alias fz 'frizzante'

    # eza aliases (only if eza is installed)
    if command -q eza
        # lh (list hidden) is a function in functions/lh.fish: it needs a
        # tolerant glob, which an alias cannot express cleanly.
        alias ld 'eza -Dl'                           # List only directories
        alias lf 'eza -fl'                           # List only files
        alias ls 'eza -al --group-directories-first' # List everything, directories first
        alias lt 'eza -al -s modified'               # List everything by time modified
    end

    # ncu alias with better formatting (only if installed)
    command -q ncu; and alias ncu 'ncu --interactive --format group'
end
