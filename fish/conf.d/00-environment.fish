# Environment: XDG defaults, PATH, editor, platform specifics.
# Runs for every shell, interactive or not, so scripts, editors, and
# ssh commands see the same environment as the terminal.
# Everything is existence-guarded: machines without a tool skip it.

# XDG base directories, respected if already set
set -q XDG_CONFIG_HOME; or set -gx XDG_CONFIG_HOME $HOME/.config
set -q XDG_DATA_HOME; or set -gx XDG_DATA_HOME $HOME/.local/share
set -q XDG_STATE_HOME; or set -gx XDG_STATE_HOME $HOME/.local/state
set -q XDG_CACHE_HOME; or set -gx XDG_CACHE_HOME $HOME/.cache

# Homebrew: Apple Silicon, Intel macOS, and Linuxbrew prefixes
for prefix in /opt/homebrew /usr/local /home/linuxbrew/.linuxbrew
    if test -x $prefix/bin/brew
        set -gx HOMEBREW_PREFIX $prefix
        fish_add_path -g $prefix/bin $prefix/sbin
        test -d $prefix/opt/llvm/bin; and fish_add_path -g $prefix/opt/llvm/bin
        break
    end
end

# Toolchains
test -d $HOME/.cargo/bin; and fish_add_path -g $HOME/.cargo/bin

if test -d $HOME/go
    set -gx GOPATH $HOME/go
    test -d $GOPATH/bin; and fish_add_path -g $GOPATH/bin
end

if test -d $HOME/.bun
    set -gx BUN_INSTALL $HOME/.bun
    fish_add_path -g $BUN_INSTALL/bin
end

# mise shims give non-interactive shells the right tool versions;
# interactive shells get full activation in 02-integrations.fish
test -d $XDG_DATA_HOME/mise/shims; and fish_add_path -g $XDG_DATA_HOME/mise/shims

# User binaries win over everything added above
test -d $HOME/.local/bin; and fish_add_path -g $HOME/.local/bin

# Best available editor
if command -q nvim
    set -gx EDITOR nvim
else if command -q vim
    set -gx EDITOR vim
else
    set -gx EDITOR vi
end
set -gx VISUAL $EDITOR

# WSL: open URLs in the Windows browser
if string match -qi '*microsoft*' (uname -r); and command -q wslview
    set -gx BROWSER wslview
end
