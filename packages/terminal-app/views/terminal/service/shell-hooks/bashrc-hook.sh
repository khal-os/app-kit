#!/bin/bash
# Genie OS Terminal Integration Hook
# This file is sourced by bash when spawned by the PTY server.
# It provides shell integration for CWD tracking via OSC 7.

# Source user's existing bashrc first to preserve customizations
if [ -f ~/.bashrc ]; then
  source ~/.bashrc
fi

# OSC 7 CWD reporting — sends current directory to terminal after each command
__os_precmd() {
  printf '\e]7;file://%s%s\e\\' "$HOSTNAME" "$PWD"
}

# Add to PROMPT_COMMAND (append, don't overwrite)
if [ -z "$PROMPT_COMMAND" ]; then
  PROMPT_COMMAND="__os_precmd"
else
  PROMPT_COMMAND="__os_precmd;${PROMPT_COMMAND}"
fi
