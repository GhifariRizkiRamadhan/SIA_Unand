@echo off
set NODE_ENV=test
npx jest tests/unit/conPmbrthnPnl.test.js --coverage --colors
