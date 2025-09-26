function theme_gruvbox_baby --description 'Apply Gruvbox Baby theme to Fish shell'
    # Gruvbox Baby color palette
    set -U fish_color_normal EBDBB2
    set -U fish_color_command 8EC07C
    set -U fish_color_quote EEBD35
    set -U fish_color_redirection 7FA2AC
    set -U fish_color_end D65D0E
    set -U fish_color_error CC241D
    set -U fish_color_param 83A598
    set -U fish_color_comment 665C54
    set -U fish_color_match --background=32302F
    set -U fish_color_selection --background=32302F
    set -U fish_color_search_match --background=504945
    set -U fish_color_history_current --bold
    set -U fish_color_operator 689D6A
    set -U fish_color_escape D4879C
    set -U fish_color_cwd 8EC07C
    set -U fish_color_cwd_root FB4934
    set -U fish_color_valid_path --underline
    set -U fish_color_autosuggestion 504945
    set -U fish_color_user 98971A
    set -U fish_color_host 83A598
    set -U fish_color_cancel -r
    set -U fish_pager_color_completion EBDBB2
    set -U fish_pager_color_description EEBD35
    set -U fish_pager_color_prefix 8EC07C --bold
    set -U fish_pager_color_progress E7D7AD --background=504945
    set -U fish_pager_color_selected_background --background=32302F

    echo "Gruvbox Baby theme applied successfully!"
    echo "You may need to restart your terminal for all changes to take effect."
end
