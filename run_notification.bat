@echo off
set NODE_ENV=test
npx jest tests/unit/notification.test.js --coverage --colors
