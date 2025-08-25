if status is-interactive
    # Fish syntax highlighting colors
    set -g fish_color_normal normal
    set -g fish_color_command blue
    set -g fish_color_quote yellow
    set -g fish_color_redirection cyan --bold
    set -g fish_color_end green
    set -g fish_color_error brred
    set -g fish_color_param cyan
    set -g fish_color_comment red
    set -g fish_color_operator brcyan
    set -g fish_color_escape brcyan
    set -g fish_color_autosuggestion 555 brblack
    set -g fish_color_cancel -r
    set -g fish_color_history_current --bold
    set -g fish_color_search_match white --background=brblack
    set -g fish_color_selection white --bold --background=brblack
    set -g fish_color_valid_path --underline
    set -g fish_color_status red
    set -g fish_color_host normal
    set -g fish_color_host_remote yellow
    set -g fish_color_user brgreen
    set -g fish_color_cwd green
    set -g fish_color_cwd_root red

    # Pager colors (for tab completions and command help)
    set -g fish_pager_color_completion normal
    set -g fish_pager_color_description B3A06D yellow -i
    set -g fish_pager_color_prefix normal --bold --underline
    set -g fish_pager_color_progress brwhite --background=cyan
    set -g fish_pager_color_selected_background -r

    # Hydro prompt colors
    set -g hydro_color_prompt 5CCFE6
    set -g hydro_color_pwd 77A8D9
    set -g hydro_color_git FFB454
    set -g hydro_color_error FF3333
    set -g hydro_color_duration 95E6CB
    set -g hydro_color_start 7E8C98
end