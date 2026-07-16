# Bash fallback: pasted bash that fish cannot parse runs through bash automatically.
#
# On Enter, if the command line is not valid fish but is complete, valid bash,
# it is rewritten to  bash -c '...'  and executed. The rewrite is visible on the
# prompt line and lands in history that way, so recalling it reruns it in bash.
# Everything else about Enter is stock fish behavior.
#
# Requires fish >= 3.2 (commandline --is-valid) and bash on PATH; machines
# without bash keep stock Enter behavior. Delete this file to disable.

if status is-interactive; and command -q bash
    # True when the buffer is complete, valid bash worth diverting.
    function __bash_fallback_wants_bash --argument-names buf
        # begin/switch/end open or close fish blocks yet also parse as plain
        # bash commands; never steal those.
        if string match -qr '^\s*(begin|switch|end)([\s;]|$)' -- $buf
            return 1
        end
        # bash -n accepts an unterminated heredoc (warning only), so require
        # the closing delimiter line to be present ourselves.
        for delim in (string match -a -r -g '(?<!<)<<(?!<)-?\s*[\'"]?(\w+)' -- $buf)
            if not contains -- $delim (string split \n -- $buf | string trim)
                return 1
            end
        end
        printf '%s\n' $buf | bash -n 2>/dev/null
    end

    function __bash_fallback_execute
        set -l buf (commandline | string collect)
        if test -n "$buf"; and not commandline --is-valid; and __bash_fallback_wants_bash $buf
            set -l esc (string replace -ra '([\\\\\'])' '\\\\$1' -- $buf | string collect)
            commandline -r -- "bash -c '$esc'"
        end
        commandline -f execute
    end

    bind enter __bash_fallback_execute
end
