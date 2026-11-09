import { describe, expect, it } from 'vitest';
import { checkField, parseNumber } from './check';
import type { Field } from './types';

const f = (kind: Field['kind'], answer: string, extra: Partial<Field> = {}): Field => ({ key: 'x', label: 'x', kind, answer, ...extra });

describe('Eingabeprüfung', () => {
  it('liest deutsche und englische Zahlen', () => {
    expect(parseNumber('8,76')).toBe(8.76);
    expect(parseNumber('8.76')).toBe(8.76);
    expect(parseNumber('1.048.576')).toBe(1048576);
    expect(parseNumber('1.234,5 €')).toBe(1234.5);
    expect(parseNumber('25 %')).toBe(25);
    expect(parseNumber(' 3 h')).toBe(3);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });
  it('Zahl mit Toleranz', () => {
    const fld = f('number', '8,76', { value: 8.76, tolerance: { abs: 0.01 } });
    expect(checkField(fld, '8,76')).toBe(true);
    expect(checkField(fld, '8,77')).toBe(true);
    expect(checkField(fld, '8,8')).toBe(false);
    expect(checkField(f('number', '100', { value: 100 }), '100,4')).toBe(true); // 0,5 % Standard
    expect(checkField(f('number', '100', { value: 100 }), '101')).toBe(false);
  });
  it('IPv4 und CIDR', () => {
    expect(checkField(f('ipv4', '192.168.10.64'), ' 192.168.10.64 ')).toBe(true);
    expect(checkField(f('ipv4', '192.168.10.64'), '192.168.010.064')).toBe(true);
    expect(checkField(f('ipv4', '192.168.10.64'), '192.168.10.65')).toBe(false);
    expect(checkField(f('cidr', '10.0.0.0/26'), '10.0.0.0 / 26')).toBe(true);
    expect(checkField(f('cidr', '10.0.0.0/26'), '10.0.0.0/27')).toBe(false);
  });
  it('IPv6-Varianten', () => {
    expect(checkField(f('ipv6', '2001:db8::1'), '2001:0DB8:0:0:0:0:0:1')).toBe(true);
    const s = f('ipv6short', '2001:db8::a00:0:0:1');
    expect(checkField(s, '2001:db8::a00:0:0:1')).toBe(true);
    expect(checkField(s, '2001:db8:0:0:a00::1')).toBe(true); // gleich kurz, anderes :: – akzeptiert
    expect(checkField(s, '2001:db8:0:0:a00:0:0:1')).toBe(false);
    expect(checkField(s, '2001:0db8::a00:0:0:1')).toBe(false);
    expect(checkField(f('ipv6full', '2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:0DB8:0000:0000:0000:0000:0000:0001')).toBe(true);
    const p = f('ipv6prefix', '2001:db8:ab00:2a::/64');
    expect(checkField(p, '2001:0db8:ab00:002a:0000:0000:0000:0000/64')).toBe(true);
    expect(checkField(p, '2001:db8:ab00:2a::1/64')).toBe(false);
    expect(checkField(f('hexgroups', '021a:2bff:fe3c:4d5e'), '21a:2bff:fe3c:4d5e')).toBe(true);
  });
  it('Binär, Hex, Pfad, Auswahl', () => {
    expect(checkField(f('bin', '101101'), '0010 1101')).toBe(true);
    expect(checkField(f('bin', '101101'), '101100')).toBe(false);
    expect(checkField(f('hex', 'FF'), '0xff')).toBe(true);
    expect(checkField(f('hex', 'FF'), 'ffh')).toBe(true);
    expect(checkField(f('path', 'A-C-E'), 'a, c, e')).toBe(true);
    expect(checkField(f('path', 'A-C-E'), 'A-E')).toBe(false);
    expect(checkField(f('choice', 'ja', { options: ['ja', 'nein'] }), 'ja')).toBe(true);
  });
});
