# Posting Format (GitHub posting mode)

Convert each CONFIRMED/LIKELY finding to an inline comment object for the `comments` array:
```json
{"path": "file.go", "line": 123, "body": "**ISSUE**\n\nDETAILS\n\n<!-- cagent-review -->"}
```

IMPORTANT: Use `jq` to construct the JSON payload. Do NOT manually build JSON strings
with `echo` — this causes double-escaping of newlines (`\n` rendered as literal text).

Build the review body and comments, then use `jq` to produce correctly-escaped JSON:
```bash
# Review body is just the assessment badge — findings go in inline comments
REVIEW_BODY="### Assessment: 🟢 APPROVE"   # or 🟡 NEEDS ATTENTION / 🔴 CRITICAL

# Start with an empty comments array
echo '[]' > /tmp/review_comments.json

# Append each finding (loop over your confirmed/likely results)
jq --arg path "$file_path" --argjson line "$line_number" \
  --arg body "$comment_body" \
  '. += [{path: $path, line: $line, body: $body}]' \
  /tmp/review_comments.json > /tmp/review_comments.tmp \
  && mv /tmp/review_comments.tmp /tmp/review_comments.json

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
