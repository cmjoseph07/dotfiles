if status is-interactive
    # mise: dev tool versions (node, ...); non-interactive shells are
    # covered by the shims PATH entry in 00-environment.fish
    command -q mise; and mise activate fish | source

    # zoxide: smarter cd
    command -q zoxide; and zoxide init fish | source

    # fzf: Ctrl-T file picker, Alt-C cd jump (Ctrl-R is taken over by atuin below)
    command -q fzf; and fzf --fish | source

    # atuin: history db + sync; binds Ctrl-R and up-arrow, must load after fzf
    if command -q atuin
        atuin init fish | source
        # atuin 18.x also grabs "?" for its opt-in AI helper; keep "?" a normal key
        bind --erase "?"
    end
end
