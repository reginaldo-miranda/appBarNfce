import React from 'react';
import '@testing-library/jest-native/extend-expect';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
beforeAll(() => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 2 } as any);
});

jest.mock('../src/services/storage', () => ({ STORAGE_KEYS: { AUTH_TOKEN: 'AUTH_TOKEN' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => (k === 'AUTH_TOKEN' ? 't' : null)),
}));

let lastUrl = '';
jest.mock('../src/services/api', () => ({
  apiService: {
    request: jest.fn(async ({ method, url }) => {
      lastUrl = url;
      if (method === 'GET' && url.startsWith('/employee/list')) {
        return { data: [{ id: 1, nome: 'Ana' }, { id: 2, nome: 'Bruno' }] };
      }
      if (method === 'GET' && url.includes('/queue') && url.includes('status=entregue')) {
        return {
          data: {
            success: true,
            data: [
              { id: 10, saleId: 1, quantidade: 1, produto: 'Suco', status: 'entregue', horario: new Date().toISOString(), mesa: 'Mesa 1', responsavel: 'Resp', funcionario: 'Func', preparedBy: 'Ana' },
              { id: 11, saleId: 1, quantidade: 2, produto: 'Café', status: 'entregue', horario: new Date().toISOString(), mesa: 'Mesa 2', responsavel: 'Resp', funcionario: 'Func', preparedBy: 'Bruno' },
            ],
          },
        };
      }
      return { data: { success: true, data: [] } };
    }),
  },
  authService: { login: jest.fn(async () => ({ data: { token: 't' } })) },
}));

import TabletBarScreen from '../src/screens/TabletBarScreen';

describe('Filtros de entregues', () => {
  it('aplica filtros de data e funcionários na URL e mostra contagem por funcionário', async () => {
    render(<TabletBarScreen setorIdOverride={2} setorNomeOverride={'Bar'} forceFilterStatus={'entregue'} />);

    await waitFor(() => {
      expect(screen.getByText('Bar')).toBeTruthy();
    });

    const chipSemana = await screen.findByText('Semana');
    fireEvent.press(chipSemana);

    await waitFor(() => {
      expect(lastUrl).toContain('/queue?status=entregue');
      expect(lastUrl).toMatch(/&from=\d{4}-\d{2}-\d{2}/);
      expect(lastUrl).toMatch(/&to=\d{4}-\d{2}-\d{2}/);
    });

    const search = screen.getByPlaceholderText('Digite o nome');
    fireEvent.changeText(search, 'Ana');
    const anaRow = await screen.findByText('Ana');
    fireEvent.press(anaRow);

    await waitFor(() => {
      expect(lastUrl).toContain('employees=1');
      // contagem mostrada ao lado do nome
      expect(screen.getByText(/\b1\b/)).toBeTruthy();
    });
  });
});