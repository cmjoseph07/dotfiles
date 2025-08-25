if status is-interactive
    # General
    alias c 'clear'

    if command -v nvim &>/dev/null
        alias vim 'nvim'
    end

    # Check if frizzante is installed before creating alias
    if command -v frizzante &>/dev/null
        alias fz 'frizzante'
    end

    # eza aliases (only if eza is installed)
    if command -v eza &>/dev/null
        alias ld 'eza -Dl'                           # List only directories
        alias lf 'eza -fl'                           # List only files
        alias lh 'eza -a | grep "^\."'              # List hidden files
        alias ls 'eza -al --group-directories-first' # List everything, directories first
        alias lt 'eza -al -s modified'              # List everything by time modified
    end

    # ncu alias with better formatting (only if installed)
    if command -v ncu &>/dev/null
        alias ncu 'ncu --interactive --format group'
    end
end
