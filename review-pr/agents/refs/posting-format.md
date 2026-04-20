# Posting Format (GitHub posting mode)

Convert each CONFIRMED/LIKELY finding to an inline comment object for the `comments` array:
```json
{"path": "file.go", "line": 123, "body": "**ISSUE**\n\nDETAILS\n\n<!-- cagent-review -->"}
```

IMPORTANT: Use `jq` to construct the JSON payload. Do NOT manually build JSON strings
with `echo` — this causes double-escaping of newlines (`\n` rendered as literal text).

# WARNING: NEVER use `--arg body "$variable"` to pass comment body text to jq.
# If the body contains `"`, backticks, or `$`, bash silently empties the variable,
# producing a blank comment on the PR. Always write the body to a temp file via a
# quoted heredoc (`<< 'EOF'`) and read it with `jq --rawfile`. A quoted heredoc
# delimiter disables ALL shell expansion — backticks, `$`, and `"` are written verbatim.

Build the review body and comments, then use `jq` to produce correctly-escaped JSON:
```bash
# Review body is just the assessment badge — findings go in inline comments
REVIEW_BODY="### Assessment: 🟢 APPROVE"   # or 🟡 NEEDS ATTENTION / 🔴 CRITICAL

# Start with an empty comments array
echo '[]' > /tmp/review_comments.json

# Append each finding using a quoted heredoc + jq --rawfile (safe for any body text)
# NEVER use --arg body "$comment_body" — shell quoting breaks on ", backticks, and $

cat > /tmp/comment_body.md << 'COMMENT_BODY_EOF'
**[SEVERITY] One-line issue summary**

Detailed explanation of the bug, trigger path, and impact.

<!-- cagent-review -->
COMMENT_BODY_EOF

jq --arg path "$file_path" --argjson line "$line_number" \
  --rawfile body /tmp/comment_body.md \
  '. += [{path: $path, line: $line, body: $body}]' \
  /tmp/review_comments.json > /tmp/review_comments.tmp \
  && mv /tmp/review_comments.tmp /tmp/review_comments.json

# Defensive: remove any comments with empty bodies before posting
jq '[.[] | select(.body | length > 0)]' /tmp/review_comments.json > /tmp/review_comments.tmp \
  && mv /tmp/review_comments.tmp /tmp/review_comments.json
echo "Posting review with $(jq length /tmp/review_comments.json) inline comment(s)"

# Use jq to assemble the final payload with proper escaping
jq -n \
  --arg body "$REVIEW_BODY" \
  --arg event "COMMENT" \
  --slurpfile comments /tmp/review_comments.json \
  '{body: $body, event: $event, comments: $comments[0]}' \
| gh api repos/{owner}/{repo}/pulls/{pr}/reviews --input -
```

The `<!-- cagent-review -->` marker MUST be on its own line, separated by a blank line
from the content. Do NOT include it in console output mode.
