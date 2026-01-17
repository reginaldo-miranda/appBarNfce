export const computeDateRange = (preset, customFrom, customTo) => {
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const today = new Date();
  if (preset === 'all' || preset == null) {
    return { from: null, to: null };
  }
  if (preset === 'hoje') {
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return { from: fmt(s), to: fmt(s) };
  }
  if (preset === 'semana') {
    const day = today.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: fmt(monday), to: fmt(sunday) };
  }
  if (preset === 'mes') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: fmt(first), to: fmt(last) };
  }
  if (customFrom?.d && customFrom?.m && customFrom?.y) {
    const s = new Date(customFrom.y, customFrom.m - 1, customFrom.d);
    let e = s;
    if (customTo?.d && customTo?.m && customTo?.y) {
      e = new Date(customTo.y, customTo.m - 1, customTo.d);
    }
    if (e.getTime() < s.getTime()) {
      return { from: fmt(s), to: fmt(s) };
    }
    return { from: fmt(s), to: fmt(e) };
  }
  return { from: null, to: null };
};

export const buildQueueParams = (status, range, employeeIds) => {
  const s = String(status || 'pendente');
  if (s !== 'entregue') return '';
  const parts = [];
  if (range?.from) parts.push(`from=${range.from}`);
  if (range?.to) parts.push(`to=${range.to}`);
  if (Array.isArray(employeeIds) && employeeIds.length > 0) parts.push(`employees=${employeeIds.join(',')}`);
  return parts.length ? `&${parts.join('&')}` : '';
};