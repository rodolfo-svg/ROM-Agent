#!/bin/bash

# ============================================================================
# ROM AGENT - UPLOAD SYSTEM TEST SUITE
# ============================================================================
# Script automatizado para testar sistema de upload
# Baseado na auditoria AGENT-UPLOAD-001
# ============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${UPLOAD_TEST_URL:-https://rom-agent-ia.onrender.com}"
CREDENTIALS_EMAIL="${UPLOAD_TEST_EMAIL:-rodolfo@rom.adv.br}"
CREDENTIALS_PASSWORD="${UPLOAD_TEST_PASSWORD:-Rodolfo@2026!}"
TEMP_DIR="/tmp/rom-upload-tests"

# Results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

print_header() {
  echo ""
  echo -e "${BLUE}============================================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}============================================================${NC}"
}

print_test() {
  echo -e "${YELLOW}[TEST]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[✓]${NC} $1"
  ((TESTS_PASSED++))
}

print_error() {
  echo -e "${RED}[✗]${NC} $1"
  ((TESTS_FAILED++))
}

print_skip() {
  echo -e "${YELLOW}[SKIP]${NC} $1"
  ((TESTS_SKIPPED++))
}

print_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

# Setup temp directory
setup() {
  print_header "SETUP"
  mkdir -p "$TEMP_DIR"
  print_info "Temp directory: $TEMP_DIR"
  print_info "Base URL: $BASE_URL"
}

cleanup() {
  print_header "CLEANUP"
  rm -rf "$TEMP_DIR"
  print_info "Temp files removed"
}

# Create test file
create_test_file() {
  local size_mb=$1
  local filename="$TEMP_DIR/test-${size_mb}mb.pdf"

  if [ ! -f "$filename" ]; then
    print_info "Creating ${size_mb}MB test file..."
    dd if=/dev/zero of="$filename" bs=1M count="$size_mb" 2>/dev/null
  fi

  echo "$filename"
}

# Login and get session cookie
login() {
  print_header "AUTHENTICATION"
  print_test "LOGIN: $CREDENTIALS_EMAIL"

  local response=$(curl -s -c "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$CREDENTIALS_EMAIL\",\"password\":\"$CREDENTIALS_PASSWORD\"}")

  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    print_success "Login successful"
    echo "$body" | grep -q '"success":true' && print_info "Session created"
    return 0
  else
    print_error "Login failed (HTTP $http_code)"
    echo "$body"
    return 1
  fi
}

# Get CSRF token
get_csrf_token() {
  local response=$(curl -s -b "$TEMP_DIR/cookies.txt" "$BASE_URL/api/csrf-token")
  local token=$(echo "$response" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
  echo "$token"
}

# ============================================================================
# TEST CASES
# ============================================================================

# TEST-001: Small File Upload (<1MB)
test_small_file() {
  print_header "TEST-001: Small File Upload (<1MB)"
  print_test "Upload file smaller than nginx default limit"

  local file=$(create_test_file 0)
  dd if=/dev/zero of="$file" bs=1K count=500 2>/dev/null  # 500KB

  local csrf_token=$(get_csrf_token)
  print_info "CSRF Token: ${csrf_token:0:20}..."

  local response=$(curl -s -b "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/kb/upload" \
    -H "x-csrf-token: $csrf_token" \
    -F "files=@$file")

  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "413" ]; then
    print_error "HTTP 413 Payload Too Large - Nginx custom NOT applied!"
    print_info "This is EXPECTED until UPLOAD-001 is fixed"
    print_skip "Test skipped due to known infrastructure issue"
    return 1
  elif [ "$http_code" = "200" ]; then
    print_success "Upload successful (HTTP 200)"
    echo "$body" | grep -q '"success":true' && print_info "Response valid"
    return 0
  else
    print_error "Unexpected HTTP code: $http_code"
    echo "$body"
    return 1
  fi
}

# TEST-002: Medium File Upload (5MB)
test_medium_file() {
  print_header "TEST-002: Medium File Upload (5MB)"
  print_test "Upload file that should use normal upload (not chunked)"

  local file=$(create_test_file 5)
  local csrf_token=$(get_csrf_token)

  local response=$(curl -s -b "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/kb/upload" \
    -H "x-csrf-token: $csrf_token" \
    -F "files=@$file")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" = "413" ]; then
    print_error "HTTP 413 - Nginx custom NOT applied"
    print_skip "Test blocked by UPLOAD-001"
    return 1
  elif [ "$http_code" = "200" ]; then
    print_success "Upload successful"
    return 0
  else
    print_error "HTTP $http_code"
    return 1
  fi
}

# TEST-003: Large File Upload (100MB) - Chunked
test_large_file_chunked() {
  print_header "TEST-003: Large File Upload (100MB) - Chunked"
  print_test "Upload file >80MB that should use chunked upload"
  print_info "This bypasses nginx and should ALWAYS work"

  local file=$(create_test_file 100)
  local csrf_token=$(get_csrf_token)
  local filename=$(basename "$file")
  local filesize=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")

  # Step 1: Initialize chunked session
  print_info "Step 1: Initialize chunked upload session"
  local init_response=$(curl -s -b "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/upload/chunked/init" \
    -H "Content-Type: application/json" \
    -H "x-csrf-token: $csrf_token" \
    -d "{\"filename\":\"$filename\",\"fileSize\":$filesize,\"contentType\":\"application/pdf\"}")

  local init_code=$(echo "$init_response" | tail -n1)
  local init_body=$(echo "$init_response" | head -n-1)

  if [ "$init_code" != "200" ]; then
    print_error "Failed to initialize chunked upload (HTTP $init_code)"
    echo "$init_body"
    return 1
  fi

  local upload_id=$(echo "$init_body" | grep -o '"uploadId":"[^"]*"' | cut -d'"' -f4)
  print_success "Chunked session initialized: $upload_id"

  # Step 2: Upload chunks (40MB each)
  local chunk_size=$((40 * 1024 * 1024))  # 40MB
  local total_chunks=$(( ($filesize + $chunk_size - 1) / $chunk_size ))
  print_info "Step 2: Upload $total_chunks chunks of 40MB each"

  for ((i=0; i<$total_chunks; i++)); do
    local start=$((i * chunk_size))
    local end=$((start + chunk_size))
    if [ $end -gt $filesize ]; then
      end=$filesize
    fi

    print_info "  Uploading chunk $((i+1))/$total_chunks (${start}-${end} bytes)"

    # Extract chunk using dd
    dd if="$file" of="$TEMP_DIR/chunk.tmp" bs=1 skip=$start count=$((end - start)) 2>/dev/null

    local chunk_response=$(curl -s -b "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
      -X POST "$BASE_URL/api/upload/chunked/$upload_id/chunk/$i" \
      --data-binary "@$TEMP_DIR/chunk.tmp")

    local chunk_code=$(echo "$chunk_response" | tail -n1)

    if [ "$chunk_code" != "200" ]; then
      print_error "Chunk $((i+1)) failed (HTTP $chunk_code)"
      return 1
    fi

    rm -f "$TEMP_DIR/chunk.tmp"
  done

  print_success "All chunks uploaded"

  # Step 3: Finalize
  print_info "Step 3: Finalize chunked upload"
  local finalize_response=$(curl -s -b "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/upload/chunked/$upload_id/finalize")

  local finalize_code=$(echo "$finalize_response" | tail -n1)
  local finalize_body=$(echo "$finalize_response" | head -n-1)

  if [ "$finalize_code" = "200" ]; then
    print_success "Chunked upload finalized successfully"
    local final_path=$(echo "$finalize_body" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)
    print_info "File saved at: $final_path"
    return 0
  else
    print_error "Finalize failed (HTTP $finalize_code)"
    echo "$finalize_body"
    return 1
  fi
}

# TEST-004: Merge Multiple PDFs
test_merge_pdfs() {
  print_header "TEST-004: Merge Multiple PDFs"
  print_test "Upload and merge 3 PDF volumes"

  # Create 3 small PDFs
  local vol1=$(create_test_file 2)
  local vol2=$(create_test_file 2)
  local vol3=$(create_test_file 2)

  mv "$vol1" "$TEMP_DIR/Vol1_test.pdf"
  mv "$vol2" "$TEMP_DIR/Vol2_test.pdf"
  mv "$vol3" "$TEMP_DIR/Vol3_test.pdf"

  local csrf_token=$(get_csrf_token)

  local response=$(curl -s -b "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/kb/merge-volumes" \
    -H "x-csrf-token: $csrf_token" \
    -F "files=@$TEMP_DIR/Vol1_test.pdf" \
    -F "files=@$TEMP_DIR/Vol2_test.pdf" \
    -F "files=@$TEMP_DIR/Vol3_test.pdf" \
    -F "processName=Teste Merge")

  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    print_success "PDFs merged successfully"
    echo "$body" | grep -q '"volumesCount":3' && print_info "3 volumes confirmed"
    return 0
  else
    print_error "Merge failed (HTTP $http_code)"
    echo "$body"
    return 1
  fi
}

# TEST-005: Check Upload Progress (SSE)
test_upload_progress_sse() {
  print_header "TEST-005: Upload Progress Tracking (SSE)"
  print_test "Connect to SSE endpoint and receive progress updates"
  print_skip "SSE testing requires advanced tools (curl doesn't handle SSE well)"
  print_info "Manual test: Upload file and monitor /api/upload-progress/:id/progress"
  return 0
}

# TEST-006: Backend Configuration Check
test_backend_config() {
  print_header "TEST-006: Backend Configuration Check"
  print_test "Verify multer limits across all routes"

  print_info "Checking file size limits in code..."

  local server_limit=$(grep -A2 "const upload = multer" /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/src/server-enhanced.js | grep "fileSize" | grep -o "[0-9]*" | head -1)
  local rom_limit=$(grep -A2 "const upload = multer" /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/src/routes/rom-project.js | grep "fileSize" | grep -o "[0-9]*" | head -1)
  local merge_limit=$(grep -A2 "const upload = multer" /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/src/routes/kb-merge-volumes.js | grep "fileSize" | grep -o "[0-9]*" | head -1)

  print_info "server-enhanced.js: ${server_limit}MB"
  print_info "rom-project.js: ${rom_limit}MB"
  print_info "kb-merge-volumes.js: ${merge_limit}MB"

  if [ "$server_limit" = "500" ] && [ "$rom_limit" = "500" ] && [ "$merge_limit" = "500" ]; then
    print_success "All limits standardized to 500MB"
    return 0
  else
    print_error "Inconsistent limits found"
    if [ "$rom_limit" != "500" ]; then
      print_error "rom-project.js has ${rom_limit}MB (expected 500MB)"
    fi
    return 1
  fi
}

# TEST-007: Nginx Configuration Check
test_nginx_config() {
  print_header "TEST-007: Nginx Configuration Check"
  print_test "Verify nginx custom config is applied"

  print_info "Checking if client_max_body_size > 1M..."

  # Try uploading 2MB file to detect nginx limit
  local file=$(create_test_file 2)
  local csrf_token=$(get_csrf_token)

  local response=$(curl -s -b "$TEMP_DIR/cookies.txt" -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/kb/upload" \
    -H "x-csrf-token: $csrf_token" \
    -F "files=@$file")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" = "413" ]; then
    print_error "HTTP 413 on 2MB file - Nginx custom NOT applied"
    print_info "Expected: client_max_body_size 1100M"
    print_info "Actual: Default 1M"
    return 1
  elif [ "$http_code" = "200" ]; then
    print_success "Nginx custom configuration is APPLIED"
    print_info "File >1MB accepted (nginx limit working)"
    return 0
  else
    print_error "Unexpected response: HTTP $http_code"
    return 1
  fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
  print_header "ROM AGENT - UPLOAD SYSTEM TEST SUITE"
  print_info "Based on AGENT-UPLOAD-001 Audit"
  print_info "Date: $(date)"

  setup

  # Authenticate
  login || {
    print_error "Login failed - aborting tests"
    cleanup
    exit 1
  }

  # Run tests
  test_nginx_config || true
  test_backend_config || true
  test_small_file || true
  test_medium_file || true
  test_large_file_chunked || true
  test_merge_pdfs || true
  test_upload_progress_sse || true

  # Summary
  print_header "TEST SUMMARY"
  echo -e "${GREEN}Passed:  $TESTS_PASSED${NC}"
  echo -e "${RED}Failed:  $TESTS_FAILED${NC}"
  echo -e "${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
  echo -e "Total:   $((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))"

  cleanup

  # Exit code
  if [ $TESTS_FAILED -gt 0 ]; then
    print_info "Some tests failed - check logs above"
    exit 1
  else
    print_success "All tests passed!"
    exit 0
  fi
}

# Run main
main
