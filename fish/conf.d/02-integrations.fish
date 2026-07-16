if status is-interactive
    # mise: dev tool versions (node, ...); non-interactive shells are
    # covered by the shims PATH entry in 00-environment.fish
    command -q mise; and mise activate fish | source

    # zoxide: smarter cd
    command -q zoxide; and zoxide init fish | source
end
