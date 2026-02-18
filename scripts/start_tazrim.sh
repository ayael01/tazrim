#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/.tazrim-runtime"

BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
FRONTEND_PID_FILE="${RUNTIME_DIR}/frontend.pid"
BACKEND_LOG_FILE="${RUNTIME_DIR}/backend.log"
FRONTEND_LOG_FILE="${RUNTIME_DIR}/frontend.log"

BACKEND_HOST="${TAZRIM_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${TAZRIM_BACKEND_PORT:-8000}"
FRONTEND_HOST="${TAZRIM_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${TAZRIM_FRONTEND_PORT:-5173}"
BACKEND_RELOAD="${TAZRIM_BACKEND_RELOAD:-0}"

OPEN_BROWSER=1
WAIT_TIMEOUT="${TAZRIM_START_TIMEOUT:-45}"

BACKEND_STARTED=0
FRONTEND_STARTED=0

log() {
  printf '[tazrim-start] %s\n' "$*"
}

fail() {
  printf '[tazrim-start] ERROR: %s\n' "$*" >&2
  stop_started_services_on_failure
  exit 1
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

cleanup_stale_pid() {
  local file="$1"
  local name="$2"
  local pid
  pid="$(read_pid "${file}")"
  if [[ -n "${pid}" ]] && ! pid_running "${pid}"; then
    log "Removing stale ${name} PID file (${pid})."
    rm -f "${file}"
  fi
}

port_in_use() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

listener_pid() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -n 1
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local timeout="$3"

  local i
  for ((i = 1; i <= timeout; i += 1)); do
    if curl --silent --show-error --fail --max-time 2 "${url}" >/dev/null 2>&1; then
      log "${name} is ready: ${url}"
      return 0
    fi
    sleep 1
  done

  return 1
}

ensure_dependencies() {
  command -v lsof >/dev/null 2>&1 || fail "Missing dependency: lsof"
  command -v curl >/dev/null 2>&1 || fail "Missing dependency: curl"
  command -v npm >/dev/null 2>&1 || fail "Missing dependency: npm"
}

load_backend_env() {
  local env_file="${REPO_ROOT}/backend/.env"
  if [[ -f "${env_file}" ]]; then
    # Export variables from backend/.env so uvicorn has DATABASE_URL and peers.
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    fail "DATABASE_URL is not set. Add it to backend/.env (or export it in your shell)."
  fi
}

stop_started_services_on_failure() {
  if [[ "${FRONTEND_STARTED}" -eq 1 ]]; then
    local fpid
    fpid="$(read_pid "${FRONTEND_PID_FILE}")"
    if pid_running "${fpid}"; then
      kill "${fpid}" >/dev/null 2>&1 || true
    fi
    rm -f "${FRONTEND_PID_FILE}"
  fi

  if [[ "${BACKEND_STARTED}" -eq 1 ]]; then
    local bpid
    bpid="$(read_pid "${BACKEND_PID_FILE}")"
    if pid_running "${bpid}"; then
      kill "${bpid}" >/dev/null 2>&1 || true
    fi
    rm -f "${BACKEND_PID_FILE}"
  fi
}

start_backend() {
  cleanup_stale_pid "${BACKEND_PID_FILE}" "backend"

  local tracked_pid
  tracked_pid="$(read_pid "${BACKEND_PID_FILE}")"
  if pid_running "${tracked_pid}"; then
    log "Backend already running (PID ${tracked_pid})."
    return 0
  fi

  if port_in_use "${BACKEND_PORT}"; then
    local port_pid
    port_pid="$(listener_pid "${BACKEND_PORT}")"
    log "Backend port ${BACKEND_PORT} already in use by PID ${port_pid:-unknown}; assuming service is already up."
    return 0
  fi

  local python_bin="${REPO_ROOT}/backend/.venv/bin/python"
  if [[ ! -x "${python_bin}" ]]; then
    if command -v python3 >/dev/null 2>&1; then
      python_bin="$(command -v python3)"
      log "backend/.venv not found; falling back to ${python_bin}."
    else
      fail "Python not found. Create backend/.venv first."
    fi
  fi

  if [[ ! -d "${REPO_ROOT}/backend/app" ]]; then
    fail "Backend app directory not found at backend/app."
  fi

  log "Starting backend on ${BACKEND_HOST}:${BACKEND_PORT} ..."
  local backend_cmd=(
    "${python_bin}" -m uvicorn app.main:app
    --host "${BACKEND_HOST}"
    --port "${BACKEND_PORT}"
  )
  if [[ "${BACKEND_RELOAD}" == "1" ]]; then
    backend_cmd+=(--reload)
  fi
  (
    cd "${REPO_ROOT}/backend"
    nohup "${backend_cmd[@]}" > "${BACKEND_LOG_FILE}" 2>&1 &
    echo $! > "${BACKEND_PID_FILE}"
  )
  BACKEND_STARTED=1

  local pid
  pid="$(read_pid "${BACKEND_PID_FILE}")"
  if ! pid_running "${pid}"; then
    fail "Backend process exited immediately. Check ${BACKEND_LOG_FILE}"
  fi

  if ! wait_for_http "http://127.0.0.1:${BACKEND_PORT}/openapi.json" "Backend" "${WAIT_TIMEOUT}"; then
    fail "Backend did not become ready in ${WAIT_TIMEOUT}s. Check ${BACKEND_LOG_FILE}"
  fi
}

start_frontend() {
  cleanup_stale_pid "${FRONTEND_PID_FILE}" "frontend"

  local tracked_pid
  tracked_pid="$(read_pid "${FRONTEND_PID_FILE}")"
  if pid_running "${tracked_pid}"; then
    log "Frontend already running (PID ${tracked_pid})."
    return 0
  fi

  if port_in_use "${FRONTEND_PORT}"; then
    local port_pid
    port_pid="$(listener_pid "${FRONTEND_PORT}")"
    log "Frontend port ${FRONTEND_PORT} already in use by PID ${port_pid:-unknown}; assuming service is already up."
    return 0
  fi

  if [[ ! -f "${REPO_ROOT}/frontend/package.json" ]]; then
    fail "frontend/package.json not found."
  fi
  if [[ ! -d "${REPO_ROOT}/frontend/node_modules" ]]; then
    fail "frontend/node_modules missing. Run: npm --prefix frontend install"
  fi

  log "Starting frontend on ${FRONTEND_HOST}:${FRONTEND_PORT} ..."
  (
    cd "${REPO_ROOT}/frontend"
    nohup npm run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" \
      > "${FRONTEND_LOG_FILE}" 2>&1 &
    echo $! > "${FRONTEND_PID_FILE}"
  )
  FRONTEND_STARTED=1

  local pid
  pid="$(read_pid "${FRONTEND_PID_FILE}")"
  if ! pid_running "${pid}"; then
    fail "Frontend process exited immediately. Check ${FRONTEND_LOG_FILE}"
  fi

  if ! wait_for_http "http://127.0.0.1:${FRONTEND_PORT}/" "Frontend" "${WAIT_TIMEOUT}"; then
    fail "Frontend did not become ready in ${WAIT_TIMEOUT}s. Check ${FRONTEND_LOG_FILE}"
  fi
}

open_browser_if_needed() {
  if [[ "${OPEN_BROWSER}" -eq 0 ]]; then
    return
  fi
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:${FRONTEND_PORT}/bank" >/dev/null 2>&1 || true
  fi
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [--no-open]

Options:
  --no-open   Do not open the browser automatically.
  --help      Show this message.
EOF
}

main() {
  while (($#)); do
    case "$1" in
      --no-open)
        OPEN_BROWSER=0
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done

  mkdir -p "${RUNTIME_DIR}"
  ensure_dependencies
  load_backend_env

  trap 'stop_started_services_on_failure' ERR

  start_backend
  start_frontend
  open_browser_if_needed

  trap - ERR

  log "Tazrim is ready."
  log "Frontend: http://localhost:${FRONTEND_PORT}/bank"
  log "Backend:  http://localhost:${BACKEND_PORT}/docs"
  log "Logs: ${BACKEND_LOG_FILE} | ${FRONTEND_LOG_FILE}"
}

main "$@"
