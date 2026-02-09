import { describe, it, expect } from 'vitest';

import { 
  VALID_KEY_TYPES, 
  ZERA_TYPE,
  ZERA_TYPE_HEX,
  ZERA_SYMBOL,
  ZERA_NAME,
  SLIP0010_DERIVATION_PATH
} from '../constants.js';

describe('Constants Module', () => {
  describe('VALID_KEY_TYPES', () => {
    it('should be an array', () => {
      expect(Array.isArray(VALID_KEY_TYPES)).toBe(true);
    });

    it('should include ed25519', () => {
      expect(VALID_KEY_TYPES.includes('ed25519')).toBe(true);
    });

    it('should include ed448', () => {
      expect(VALID_KEY_TYPES.includes('ed448')).toBe(true);
    });

    it('should have 2 elements', () => {
      expect(VALID_KEY_TYPES.length).toBe(2);
    });
  });

  describe('ZERA Network constants', () => {
    it('should have correct ZERA_TYPE', () => {
      expect(ZERA_TYPE).toBe(1110);
    });

    it('should have correct ZERA_TYPE_HEX', () => {
      expect(ZERA_TYPE_HEX).toBe('0x80000456');
    });

    it('should have correct ZERA_SYMBOL', () => {
      expect(ZERA_SYMBOL).toBe('ZRA');
    });

    it('should have correct ZERA_NAME', () => {
      expect(ZERA_NAME).toBe('ZERA');
    });
  });

  describe('Derivation path', () => {
    it('should be SLIP-0010 format (all hardened)', () => {
      expect(SLIP0010_DERIVATION_PATH).toBe('m/44\'/1110\'/0\'/0\'/0\'');
    });
  });
});