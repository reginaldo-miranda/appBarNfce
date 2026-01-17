import { computeDateRange, buildQueueParams } from '../src/utils/filters';

describe('computeDateRange', () => {
  it('hoje retorna mesmo dia', () => {
    const r = computeDateRange('hoje');
    expect(r.from).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(r.to).toEqual(r.from);
  });
  it('semana retorna 7 dias', () => {
    const r = computeDateRange('semana');
    expect(r.from).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(r.to).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it('mes retorna dentro do mês corrente', () => {
    const r = computeDateRange('mes');
    const y = new Date().getFullYear(); const m = String(new Date().getMonth()+1).padStart(2,'0');
    expect(r.from.startsWith(`${y}-${m}`)).toBe(true);
    expect(r.to.startsWith(`${y}-${m}`)).toBe(true);
  });
  it('custom valida fim >= início', () => {
    const r = computeDateRange('custom', { d: 10, m: 1, y: 2025 }, { d: 5, m: 1, y: 2025 });
    expect(r.from).toBe('2025-01-10');
    expect(r.to).toBe('2025-01-10');
  });
});

describe('buildQueueParams', () => {
  it('somente em entregues', () => {
    const p1 = buildQueueParams('pendente', { from: '2025-01-01', to: '2025-01-07' }, [1]);
    expect(p1).toBe('');
    const p2 = buildQueueParams('entregue', { from: '2025-01-01', to: '2025-01-07' }, [1,2]);
    expect(p2).toContain('from=2025-01-01');
    expect(p2).toContain('to=2025-01-07');
    expect(p2).toContain('employees=1,2');
  });
});