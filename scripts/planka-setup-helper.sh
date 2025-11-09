#!/bin/bash

echo "=== Planka Setup Helper ==="
echo ""
echo "1. Откройте Planka: http://localhost:3333"
echo "2. Войдите (admin@localhost / admin)"
echo "3. Откройте DevTools (F12) → Network tab"
echo "4. Обновите страницу (F5)"
echo "5. Найдите запрос к 'boards' в Network tab"
echo "6. Кликните на него → Headers → найдите 'authorization: Bearer ...'"
echo ""
echo "Введите TOKEN (без 'Bearer '):"
read -r TOKEN

echo ""
echo "Получаю Board ID..."
BOARD_RESPONSE=$(curl -s "http://localhost:3333/api/boards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json")

if echo "$BOARD_RESPONSE" | grep -q "WayMates"; then
  BOARD_ID=$(echo "$BOARD_RESPONSE" | jq -r '.items[] | select(.name=="WayMates") | .id')
  echo "✅ BOARD_ID: $BOARD_ID"

  echo ""
  echo "Получаю List IDs..."
  LISTS_RESPONSE=$(curl -s "http://localhost:3333/api/boards/$BOARD_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json")

  echo "✅ LIST IDs:"
  echo "$LISTS_RESPONSE" | jq -r '.included.lists[] | "\(.name): \(.id)"'

  echo ""
  echo "=== Создайте .env.planka с этими значениями ==="
  echo ""
  echo "PLANKA_URL=http://localhost:3333"
  echo "PLANKA_TOKEN=$TOKEN"
  echo "PLANKA_BOARD_ID=$BOARD_ID"
  echo ""
  echo "# Скопируйте нужные List IDs выше:"
  echo "PLANKA_LIST_CRITICAL=..."
  echo "PLANKA_LIST_URGENT=..."
  echo "PLANKA_LIST_HIGH=..."
  echo "PLANKA_LIST_MEDIUM=..."
  echo "PLANKA_LIST_LOW=..."
else
  echo "❌ Ошибка: не удалось получить boards"
  echo "Проверьте TOKEN"
fi
