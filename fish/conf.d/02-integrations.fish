if status is-interactive
    # Initialize zoxide if installed
    if command -v zoxide &>/dev/null
        zoxide init fish | source
    end

    # Hydro prompt configuration
    set --global hydro_symbol_git_dirty ' •'
end