#!/usr/bin/env fish
# Bootstrap a fresh machine after cloning this repo to ~/.config:
#
#     fish bootstrap.fish
#
# Idempotent, safe to re-run any time. Installs fisher and its plugins,
# provisions mise tools, then reports missing tools with an install hint.

# ── fisher and plugins ────────────────────────────────────────────────────────
if not functions -q fisher
    echo "Installing fisher..."
    curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source
    and fisher install jorgebucaran/fisher
    or begin
        echo "fisher install failed; check your network and re-run." >&2
        exit 1
    end
end
echo "Syncing fish plugins..."
fisher update

# ── mise-managed tools (node, ...) ────────────────────────────────────────────
if command -q mise
    echo "Installing mise tools..."
    mise install --yes
end

# ── tool report ───────────────────────────────────────────────────────────────
# Maps a command to its package name for the detected package manager.
function _pkg_name --argument-names mgr tool
    switch "$mgr:$tool"
        case 'apt:fd' 'dnf:fd'
            echo fd-find
        case '*:rg'
            echo ripgrep
        case '*:nvim'
            echo neovim
        case '*'
            echo $tool
    end
end

set -l tools fzf eza bat fd rg zoxide mise fastfetch nvim
set -l missing
echo
echo "Tools:"
for tool in $tools
    if command -q $tool
        echo "  ok       $tool"
    else
        echo "  missing  $tool"
        set -a missing $tool
    end
end

if test (count $missing) -gt 0
    set -l mgr
    set -l cmd
    if command -q brew
        set mgr brew
        set cmd "brew install"
    else if command -q apt-get
        set mgr apt
        set cmd "sudo apt install"
    else if command -q dnf
        set mgr dnf
        set cmd "sudo dnf install"
    else if command -q pacman
        set mgr pacman
        set cmd "sudo pacman -S"
    end

    echo
    if test -n "$mgr"
        set -l pkgs
        for tool in $missing
            # mise is not in the apt/dnf repos; it has its own installer
            if test $tool = mise; and contains $mgr apt dnf
                echo "Install mise with:  curl https://mise.run | sh"
            else
                set -a pkgs (_pkg_name $mgr $tool)
            end
        end
        test (count $pkgs) -gt 0; and echo "Install missing tools with:  $cmd $pkgs"
        contains $mgr apt dnf
        and echo "(Debian/Fedora note: bat and fd install their binaries as batcat and fdfind.)"
    else
        echo "No known package manager found; install manually: $missing"
    end
end

functions -e _pkg_name

# ── login shell ───────────────────────────────────────────────────────────────
if not string match -q '*fish*' "$SHELL"
    echo
    echo "Make fish the login shell:"
    echo "  chsh -s "(status fish-path)
    echo "  (add "(status fish-path)" to /etc/shells first if it is not listed)"
end

echo
echo "Done. Open a new terminal to pick everything up."
