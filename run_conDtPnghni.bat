@echo off
set NODE_ENV=test
npx jest tests/unit/conDtPnghni.unit.test.js --coverage --colors
