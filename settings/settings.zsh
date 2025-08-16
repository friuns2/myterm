alias cu='cursor-agent -f'
alias gemini='gemini --yolo'
alias qwen='qwen --yolo'
alias crush='crush -y'
alias qodo='qodo -y'
alias claude='ccr code --dangerously-skip-permissions'
source "${0:A:h}/api.zsh"

alias chrome='"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"'
alias chromium='"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"'
alias google-chrome='"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"'


function t3() {
  local next_num=1
  mkdir -p ./worktrees
  while [[ -d "./worktrees/w${next_num}" ]]; do next_num=$((next_num + 1)); done
  local wtname="worktrees/w${next_num}"
  local branch="w${next_num}"
  git worktree add -b "$branch" "$wtname" || return 1
  [[ -n "$1" ]] || return 0
  local session="$branch"
  if command -v tmux >/dev/null 2>&1; then
    tmux new-session -d -s "$session" -c "$wtname" "zsh -ic \"$*; exec zsh -i\""
    tmux switch-client -t "$session" 2>/dev/null || tmux attach -t "$session"
  else
    (cd "$wtname" && zsh -ic "$*")
  fi
}

msh() {
  local usage="usage: msh <project-path>"
  [[ -n "$1" ]] || { echo "$usage"; return 1; }
  local abs
  abs="$(cd "$1" 2>/dev/null && pwd || true)" || true
  [[ -n "$abs" && -d "$abs" ]] || { echo "no such dir: $1"; return 1; }
  local projects_dir
  projects_dir="$(cd "${(%):-%N:h}/../.." && pwd)/projects"
  local name="${abs:t}"
  mkdir -p "$projects_dir" || return 1
  local target="$projects_dir/$name"
  [[ -e "$target" ]] && { echo "exists: $target"; return 0; }
  ln -s "$abs" "$target" && echo "linked $name -> $abs"
}
