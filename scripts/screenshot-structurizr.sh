#!/bin/bash
# Screenshot Structurizr diagram for Claude visual analysis
# Usage: npm run structurizr:screenshot [url] [output]

URL="${1:-http://localhost:8080}"
OUTPUT="${2:-/tmp/structurizr-diagram.png}"

echo "Taking screenshot of: $URL"
echo "Saving to: $OUTPUT"

chromium --headless=new \
  --no-sandbox \
  --disable-gpu \
  --screenshot="$OUTPUT" \
  --window-size=1920,1080 \
  --virtual-time-budget=15000 \
  "$URL"

if [ $? -eq 0 ]; then
  echo "✓ Screenshot saved: $OUTPUT"
  ls -lh "$OUTPUT" | awk '{print "  Size:", $5}'
else
  echo "✗ Failed to take screenshot"
  exit 1
fi
