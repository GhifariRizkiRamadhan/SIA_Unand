@echo off
set NODE_ENV=test
npx jest tests/unit/conLogin.unit.test.js --coverage --colors
