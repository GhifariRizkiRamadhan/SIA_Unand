@echo off
set NODE_ENV=test
npx jest tests/unit/conRegis.unit.test.js --coverage --colors
