#!/bin/bash
# run.sh <logfile> <command...> : records command, start/end time, duration and exit code
log="$1"; shift
{ echo "\$ $*"; echo "started: $(date -Is)"; s=$(date +%s); "$@" 2>&1; rc=$?; echo; echo "finished: $(date -Is)  duration: $(( $(date +%s)-s ))s  exit=$rc"; } > "$log"
