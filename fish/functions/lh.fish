function lh --description "List hidden entries in a directory, long format"
    # A bare `eza -ald .*` is a hard error in a directory with no dotfiles,
    # because fish aborts the command on a wildcard that matches nothing.
    # Globbing into a variable first is tolerant: no match just yields an
    # empty list, so this stays quiet instead of erroring.
    set -l hidden
    if set -q argv[1]
        set hidden $argv[1]/.*
    else
        set hidden .*
    end

    test (count $hidden) -gt 0; or return 0

    eza -ald $hidden
end
