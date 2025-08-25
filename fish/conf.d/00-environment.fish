if status is-interactive
    # Detect platform
    switch (uname)
        case Darwin
            set -gx IS_MAC true
            set -gx IS_LINUX false
            set -gx IS_WSL false
        case Linux
            if string match -q "*microsoft*" (uname -r)
                set -gx IS_WSL true
                set -gx IS_LINUX true
                set -gx IS_MAC false
            else
                set -gx IS_WSL false
                set -gx IS_LINUX true
                set -gx IS_MAC false
            end
        case '*'
            set -gx IS_MAC false
            set -gx IS_LINUX false
            set -gx IS_WSL false
    end

    # Universal paths that work everywhere
    if test -d "$HOME/.local/bin"
        fish_add_path -g "$HOME/.local/bin"
    end

    if test -d "$HOME/.cargo/bin"
        fish_add_path -g "$HOME/.cargo/bin"
    end

    if test -d "$HOME/go"
        set -gx GOPATH "$HOME/go"
        test -d "$GOPATH/bin"; and fish_add_path -g "$GOPATH/bin"
    end

    if test -d "$HOME/.bun"
        set -gx BUN_INSTALL "$HOME/.bun"
        fish_add_path -g "$BUN_INSTALL/bin"
    end

    # Mac-specific paths
    if test "$IS_MAC" = true
        test -d "/opt/homebrew/bin"; and fish_add_path -g "/opt/homebrew/bin"
        test -d "/opt/homebrew/opt/llvm/bin"; and fish_add_path -g "/opt/homebrew/opt/llvm/bin"
    end

    # WSL-specific settings
    if test "$IS_WSL" = true
        if test -n "$WSLENV"
            set -gx BROWSER "wslview"
        end
    end
end