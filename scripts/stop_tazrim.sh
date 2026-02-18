#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/.tazrim-runtime"

BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
FRONTEND_PID_FILE="${RUNTIME_DIR}/frontend.pid"

BACKEND_PORT="${TAZRIM_BACKEND_PORT:-8000}"
FRONTEND_PORT="${TAZRIM_FRONTEND_PORT:-5173}"
GRACE_SECONDS="${TAZRIM_STOP_GRACE_SECONDS:-10}"
HARD_STOP=0

log() {
  printf '[tazrim-stop] %s\n' "$*"
}

read_pid() {
  local file="$1"
  if [[ -f "${file}" ]]; then
    tr -d '[:space:]' < "${file}"
  fi
}

pid_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

wait_until_stopped() {
  local pid="$1"
  local seconds="$2"
  local i
  for ((i = 1; i <= seconds; i += 1)); do
    if ! pid_running "${pid}"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

stop_by_pid_file() {
  local file="$1"
  local name="$2"
  local pid
  pid="$(read_pid "${file}")"

  if [[ -z "${pid}" ]]; then
    log "${name}: no PID file."
    return 0
  fi

  if ! pid_running "${pid}"; then
    log "${name}: stale PID file (${pid}) removed."
    rm -f "${file}"
    return 0
  fi

  log "Stopping ${name} (PID ${pid}) ..."
  kill "${pid}" >/dev/null 2>&1 || true
  if wait_until_stopped "${pid}" "${GRACE_SECONDS}"; then
    rm -f "${file}"
    log "${name}: stopped."
    return 0
  fi

  log "${name}: did not stop in ${GRACE_SECONDS}s, sending SIGKILL."
  kill -9 "${pid}" >/dev/null 2>&1 || true
  rm -f "${file}"
}

port_listener_pids() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true
}

hard_stop_by_port() {
  local port="$1"
  local name="$2"
  local pids
  pids="$(port_listener_pids "${port}")"
  if [[ -z "${pids}" ]]; then
    return 0
  fi
  log "${name}: hard-stop enabled, killing listeners on port ${port}: ${pids}"
  # shellcheck disable=SC2086
  kill ${pids} >/dev/null 2>&1 || true
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [--hard]

Options:
  --hard      Also kill any process listening on backend/frontend ports.
  --help      Show this message.
EOF
}

main() {
  while (($#)); do
    case "$1" in
      --hard)
        HARD_STOP=1
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        log "Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
  done

  stop_by_pid_file "${FRONTEND_PID_FILE}" "Frontend"
  stop_by_pid_file "${BACKEND_PID_FILE}" "Backend"

  if [[ "${HARD_STOP}" -eq 1 ]]; then
    hard_stop_by_port "${FRONTEND_PORT}" "Frontend"
    hard_stop_by_port "${BACKEND_PORT}" "Backend"
  fi

  if [[ "${HARD_STOP}" -eq 0 ]]; then
    local frontend_left
    local backend_left
    frontend_left="$(port_listener_pids "${FRONTEND_PORT}" | tr '\n' ' ' | xargs)"
    backend_left="$(port_listener_pids "${BACKEND_PORT}" | tr '\n' ' ' | xargs)"
    if [[ -n "${frontend_left}" ]]; then
      log "Frontend port ${FRONTEND_PORT} still in use by PID(s): ${frontend_left}. Run with --hard if needed."
    fi
    if [[ -n "${backend_left}" ]]; then
      log "Backend port ${BACKEND_PORT} still in use by PID(s): ${backend_left}. Run with --hard if needed."
    fi
  fi

  log "Done."
}

main "$@"
