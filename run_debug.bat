@echo off
call node node_modules/jest/bin/jest.js tests/unit/conProfile.unit.test.js tests/unit/conIzinKeluar.unit.test.js --verbose > test_output.txt 2>&1
