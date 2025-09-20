if status is-interactive
    # Initialize zoxide if installed
    if command -v zoxide &>/dev/null
        zoxide init fish | source
    end

    starship init fish | source
end
