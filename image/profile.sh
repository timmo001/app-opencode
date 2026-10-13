# Debian's /etc/profile resets PATH for login shells, such as OpenCode's terminal, which drops
# mise's shims. Put them back in the same order as the image's PATH. /etc/bash.bashrc runs
# this too, since /etc/profile reads that before /etc/profile.d.
case ":$PATH:" in
  *":/usr/local/share/mise/shims:"*) ;;
  *) export PATH="$HOME/.local/share/mise/shims:/usr/local/share/mise/shims:$PATH" ;;
esac
