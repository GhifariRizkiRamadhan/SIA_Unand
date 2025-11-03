// tests/__mocks__/fs.js
// Mock fs module untuk menghindari error file system dalam test
const fs = jest.createMockFromModule('fs');

// Override unlinkSync untuk tidak error
fs.unlinkSync = jest.fn();
fs.existsSync = jest.fn().mockReturnValue(false);

module.exports = fs;